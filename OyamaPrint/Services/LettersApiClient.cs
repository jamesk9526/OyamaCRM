using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using OyamaPrint.Models;

namespace OyamaPrint.Services;

public sealed class LettersApiClient
{
    private const string RefreshCookieName = "oyama_refresh";
    private readonly CookieContainer _cookies = new();
    private readonly HttpClient _http;
    private readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private DateTimeOffset _accessTokenExpiresAt = DateTimeOffset.MinValue;

    public LettersApiClient() => _http = new HttpClient(new HttpClientHandler { CookieContainer = _cookies, UseCookies = true });

    public Uri? BaseUri => _http.BaseAddress;
    public string? AccessToken { get; private set; }

    public void Configure(string baseUrl, string? bearerToken = null)
    {
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        SetAccessToken(bearerToken);
    }

    public async Task<LoginResult> LoginAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        using var response = await _http.PostAsync("api/auth/login", Json(JsonSerializer.Serialize(new { email, password }, _json)), cancellationToken);
        await EnsureSuccessAsync(response);
        return await ReadLoginResultAsync(response, cancellationToken);
    }

    public async Task<LoginResult> VerifyMfaAsync(string ticket, string code, CancellationToken cancellationToken = default)
    {
        using var response = await _http.PostAsync("api/auth/mfa/verify", Json(JsonSerializer.Serialize(new { ticket, code }, _json)), cancellationToken);
        await EnsureSuccessAsync(response);
        return await ReadLoginResultAsync(response, cancellationToken);
    }

    public void RememberSession()
    {
        if (BaseUri is null) return;
        var cookie = _cookies.GetCookies(new Uri(BaseUri, "api/auth")).Cast<Cookie>().FirstOrDefault(item => item.Name == RefreshCookieName);
        if (cookie is null || string.IsNullOrWhiteSpace(cookie.Value)) return;
        CredentialStore.Save(JsonSerializer.Serialize(new RememberedSession(BaseUri.ToString(), cookie.Value), _json));
    }

    public static void ForgetSession() => CredentialStore.Clear();

    public async Task LogoutAsync(CancellationToken cancellationToken = default)
    {
        try { using var response = await _http.PostAsync("api/auth/logout", content: null, cancellationToken); }
        finally { SetAccessToken(null); ForgetSession(); }
    }

    public async Task<LoginResult?> TryRestoreSessionAsync(CancellationToken cancellationToken = default)
    {
        var saved = CredentialStore.Read();
        if (string.IsNullOrWhiteSpace(saved)) return null;
        try
        {
            var session = JsonSerializer.Deserialize<RememberedSession>(saved, _json);
            if (session is null || string.IsNullOrWhiteSpace(session.BaseUrl) || string.IsNullOrWhiteSpace(session.RefreshToken)) return null;
            Configure(session.BaseUrl);
            var refreshUri = new Uri(BaseUri!, "api/auth");
            _cookies.Add(refreshUri, new Cookie(RefreshCookieName, session.RefreshToken, "/api/auth", refreshUri.Host) { Secure = refreshUri.Scheme == Uri.UriSchemeHttps });
            using var response = await _http.PostAsync("api/auth/refresh", content: null, cancellationToken);
            if (!response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.NoContent)
            {
                ForgetSession();
                return null;
            }
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            SetAccessToken(document.RootElement.GetProperty("data").GetProperty("accessToken").GetString());
            var user = await GetCurrentUserAsync(cancellationToken);
            RememberSession();
            return new LoginResult(AccessToken, user, false, null, null);
        }
        catch
        {
            ForgetSession();
            return null;
        }
    }

    public async Task<AuthUser> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.GetAsync("api/auth/me", cancellationToken);
        await EnsureSuccessAsync(response);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return ReadUser(document.RootElement.GetProperty("data"));
    }

    public async Task<BrandingSettings> GetBrandingAsync(CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.GetAsync("api/settings/branding", cancellationToken);
        await EnsureSuccessAsync(response);
        return await DeserializeAsync<BrandingSettings>(response, cancellationToken);
    }

    public Uri? ResolveAssetUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || BaseUri is null) return null;
        return Uri.TryCreate(value, UriKind.Absolute, out var absolute) ? absolute : new Uri(BaseUri, value.TrimStart('/'));
    }

    public async Task<IReadOnlyList<AudienceList>> GetAudienceListsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.GetAsync("api/email-campaigns/lists", cancellationToken);
        await EnsureSuccessAsync(response);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return document.RootElement.EnumerateArray().Select(item => new AudienceList(item.GetProperty("id").GetString() ?? "", item.GetProperty("name").GetString() ?? "Untitled list", item.TryGetProperty("recipientsCount", out var count) ? count.GetInt32() : 0, item.TryGetProperty("description", out var description) ? description.GetString() : null)).ToList();
    }

    public async Task<IReadOnlyList<LetterTemplateSummary>> GetTemplatesAsync(CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.GetAsync("api/letters/templates", cancellationToken);
        await EnsureSuccessAsync(response);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return document.RootElement.EnumerateArray().Select(item => new LetterTemplateSummary(item.GetProperty("id").GetString() ?? "", item.GetProperty("name").GetString() ?? "Untitled letter", item.TryGetProperty("status", out var status) ? status.GetString() : null, item.TryGetProperty("category", out var category) ? category.GetString() : null)).ToList();
    }

    public async Task<LetterTemplateDetail> GetTemplateAsync(string id, CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.GetAsync($"api/letters/templates/{Uri.EscapeDataString(id)}", cancellationToken);
        await EnsureSuccessAsync(response);
        return await DeserializeAsync<LetterTemplateDetail>(response, cancellationToken);
    }

    public async Task<MergedLetterPreview> GetMergedPreviewAsync(string templateId, string constituentId, CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        var path = $"api/letters/templates/{Uri.EscapeDataString(templateId)}/print-preview?constituentId={Uri.EscapeDataString(constituentId)}";
        using var response = await _http.GetAsync(path, cancellationToken);
        await EnsureSuccessAsync(response);
        return await DeserializeAsync<MergedLetterPreview>(response, cancellationToken);
    }

    public async Task<IReadOnlyList<MergeFieldSection>> GetMergeFieldsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.GetAsync("api/letters/merge-fields", cancellationToken);
        await EnsureSuccessAsync(response);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return document.RootElement.GetProperty("sections").EnumerateArray().Select(section => new MergeFieldSection
        {
            Key = section.GetProperty("key").GetString() ?? "",
            Label = section.GetProperty("label").GetString() ?? "Fields",
            Fields = section.GetProperty("fields").EnumerateArray().Select(field => field.GetString() ?? "").Where(field => field.Length > 0).ToList(),
        }).ToList();
    }

    public async Task<LetterTemplateDetail> SaveTemplateAsync(string? id, TemplateDraft draft, CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        var path = string.IsNullOrWhiteSpace(id) ? "api/letters/templates" : $"api/letters/templates/{Uri.EscapeDataString(id)}";
        using var request = new HttpRequestMessage(string.IsNullOrWhiteSpace(id) ? HttpMethod.Post : HttpMethod.Patch, path) { Content = Json(JsonSerializer.Serialize(draft, _json)) };
        using var response = await _http.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response);
        return await DeserializeAsync<LetterTemplateDetail>(response, cancellationToken);
    }

    public async Task<IReadOnlyList<ConstituentSummary>> SearchConstituentsAsync(string query, CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        var path = $"api/constituents?search={Uri.EscapeDataString(query.Trim())}&limit=20";
        using var response = await _http.GetAsync(path, cancellationToken);
        await EnsureSuccessAsync(response);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var root = document.RootElement;
        var items = root.ValueKind == JsonValueKind.Array ? root : root.GetProperty("items");
        return JsonSerializer.Deserialize<List<ConstituentSummary>>(items.GetRawText(), _json) ?? [];
    }

    public async Task<LetterTemplateDetail> DuplicateTemplateAsync(string id, CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.PostAsync($"api/letters/templates/{Uri.EscapeDataString(id)}/duplicate", content: null, cancellationToken);
        await EnsureSuccessAsync(response);
        return await DeserializeAsync<LetterTemplateDetail>(response, cancellationToken);
    }

    public async Task PublishTemplateAsync(string id, CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        var path = $"api/letters/templates/{Uri.EscapeDataString(id)}/publish";
        using (var preflightResponse = await _http.PostAsync(path, Json("{\"confirm\":false}"), cancellationToken))
        {
            await EnsureSuccessAsync(preflightResponse);
            using var document = JsonDocument.Parse(await preflightResponse.Content.ReadAsStringAsync(cancellationToken));
            var blockers = document.RootElement.TryGetProperty("blockers", out var blockerArray)
                ? blockerArray.EnumerateArray().Select(item => item.GetString()).Where(value => !string.IsNullOrWhiteSpace(value)).ToList()
                : [];
            if (blockers.Count > 0) throw new InvalidOperationException("Publish blocked: " + string.Join(" ", blockers));
        }
        using var response = await _http.PostAsync(path, Json("{\"confirm\":true}"), cancellationToken);
        await EnsureSuccessAsync(response);
    }

    public async Task ArchiveTemplateAsync(string id, CancellationToken cancellationToken = default)
    {
        await EnsureFreshAccessTokenAsync(cancellationToken);
        using var response = await _http.DeleteAsync($"api/letters/templates/{Uri.EscapeDataString(id)}", cancellationToken);
        await EnsureSuccessAsync(response);
    }

    private async Task<LoginResult> ReadLoginResultAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var data = document.RootElement.GetProperty("data");
        if (data.TryGetProperty("mfaRequired", out var mfa) && mfa.GetBoolean())
            return new LoginResult(null, null, true, data.GetProperty("mfaTicket").GetString(), data.TryGetProperty("destinationHint", out var destination) ? destination.GetString() : null);
        SetAccessToken(data.GetProperty("accessToken").GetString());
        return new LoginResult(AccessToken, ReadUser(data.GetProperty("user")), false, null, null);
    }

    private void SetAccessToken(string? token)
    {
        AccessToken = token;
        _accessTokenExpiresAt = ReadTokenExpiry(token);
        _http.DefaultRequestHeaders.Authorization = string.IsNullOrWhiteSpace(token) ? null : new AuthenticationHeaderValue("Bearer", token.Trim());
    }

    private async Task EnsureFreshAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(AccessToken) || _accessTokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2)) return;
        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            if (_accessTokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2)) return;
            using var response = await _http.PostAsync("api/auth/refresh", content: null, cancellationToken);
            if (!response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.NoContent) throw new UnauthorizedAccessException("Your Oyama CRM session has expired. Please sign in again.");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            SetAccessToken(document.RootElement.GetProperty("data").GetProperty("accessToken").GetString());
            RememberSession();
        }
        finally { _refreshLock.Release(); }
    }

    private static DateTimeOffset ReadTokenExpiry(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return DateTimeOffset.MinValue;
        try
        {
            var segment = token.Split('.')[1].Replace('-', '+').Replace('_', '/');
            segment = segment.PadRight(segment.Length + ((4 - segment.Length % 4) % 4), '=');
            using var payload = JsonDocument.Parse(Convert.FromBase64String(segment));
            return payload.RootElement.TryGetProperty("exp", out var exp) ? DateTimeOffset.FromUnixTimeSeconds(exp.GetInt64()) : DateTimeOffset.MaxValue;
        }
        catch { return DateTimeOffset.MaxValue; }
    }

    private static StringContent Json(string payload) => new(payload, Encoding.UTF8, "application/json");
    private async Task<T> DeserializeAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken) => JsonSerializer.Deserialize<T>(await response.Content.ReadAsStringAsync(cancellationToken), _json) ?? throw new InvalidOperationException("The API returned an empty response.");
    private static async Task EnsureSuccessAsync(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode) return;
        var body = await response.Content.ReadAsStringAsync();
        throw new HttpRequestException($"{(int)response.StatusCode} {response.ReasonPhrase}: {body}");
    }

    private static AuthUser ReadUser(JsonElement user) => new(user.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "", user.TryGetProperty("email", out var email) ? email.GetString() ?? "" : "", user.TryGetProperty("firstName", out var first) ? first.GetString() ?? "" : "", user.TryGetProperty("lastName", out var last) ? last.GetString() ?? "" : "", user.TryGetProperty("role", out var role) ? role.GetString() ?? "" : "", user.TryGetProperty("organizationId", out var org) ? org.GetString() ?? "" : "");
    private sealed record RememberedSession(string BaseUrl, string RefreshToken);
}
