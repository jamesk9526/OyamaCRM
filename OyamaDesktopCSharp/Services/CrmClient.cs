using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
namespace OyamaDesktop.Services;
public sealed class CrmClient : IDisposable {
 readonly HttpClient http;
 public CrmClient(Uri site) { if (site.Scheme != "https" && !(site.IsLoopback && site.Scheme == "http")) throw new ArgumentException("Use HTTPS, or HTTP for localhost development."); if (!string.IsNullOrEmpty(site.UserInfo) || site.AbsolutePath != "/" || site.Query.Length > 0 || site.Fragment.Length > 0) throw new ArgumentException("Enter the CRM site origin only."); http = new(new HttpClientHandler { CookieContainer = new CookieContainer(), AllowAutoRedirect = false }) { BaseAddress = new Uri(site, "api/"), Timeout = TimeSpan.FromSeconds(30) }; }
 public async Task<JsonElement> SendAsync(string path, object? body = null, CancellationToken ct = default) {
 using var initial = body is null ? await http.GetAsync(path, ct) : await http.PostAsJsonAsync(path, body, ct);
 HttpResponseMessage? retry = null;
 if(initial.StatusCode == HttpStatusCode.Unauthorized && !path.StartsWith("auth/")) {
  using var refresh=await http.PostAsJsonAsync("auth/refresh",new {},ct);
  if(refresh.IsSuccessStatusCode) { using var document=JsonDocument.Parse(await refresh.Content.ReadAsStringAsync(ct)); SetToken(document.RootElement.GetProperty("data")); retry=body is null ? await http.GetAsync(path,ct) : await http.PostAsJsonAsync(path,body,ct); }
 }
 using var renewed=retry;
 var response=renewed??initial;
 var text = await response.Content.ReadAsStringAsync(ct);
 if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"CRM request failed ({(int)response.StatusCode}). Check sign-in, permissions, and connection.");
 using var doc = JsonDocument.Parse(text); return doc.RootElement.Clone();
 }
 public async Task<JsonElement> SignInAsync(string email, string password) { var result = await SendAsync("auth/login", new {email,password}); var data=result.GetProperty("data"); SetToken(data); return data; }
 public async Task VerifyAsync(string ticket, string code) { var result=await SendAsync("auth/mfa/verify",new{ticket,code}); SetToken(result.GetProperty("data")); }
 void SetToken(JsonElement data) { if(data.TryGetProperty("accessToken",out var token)) http.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token.GetString()); }
 public void Dispose() => http.Dispose();
}
