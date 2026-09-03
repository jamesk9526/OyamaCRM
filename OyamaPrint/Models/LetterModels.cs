namespace OyamaPrint.Models;

public sealed record LetterTemplateSummary(string Id, string Name, string? Status, string? Category);

public sealed class LetterTemplateDetail
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string? Description { get; init; }
    public string? Status { get; init; }
    public string? Category { get; init; }
    public string? PrintSubject { get; init; }
    public string PrintBody { get; init; } = "<p></p>";
    public object? PrintLayoutJson { get; init; }
    public string? SignatureBlockId { get; init; }
}

public sealed class MergeFieldSection
{
    public string Key { get; init; } = "";
    public string Label { get; init; } = "";
    public IReadOnlyList<string> Fields { get; init; } = Array.Empty<string>();
}

public sealed class MergedLetterPreview
{
    public string TemplateId { get; init; } = "";
    public string TemplateName { get; init; } = "";
    public string MergedPrintBody { get; init; } = "<p></p>";
    public IReadOnlyList<string> MissingFields { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> UnsupportedFields { get; init; } = Array.Empty<string>();
}

public sealed class ConstituentSummary
{
    public string Id { get; init; } = "";
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? DisplayName { get; init; }
    public string? OrganizationName { get; init; }
    public string? Email { get; init; }
    public string? AddressLine1 { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Zip { get; init; }
    public bool DoNotMail { get; init; }

    public string Name => !string.IsNullOrWhiteSpace(DisplayName)
        ? DisplayName
        : !string.IsNullOrWhiteSpace(OrganizationName)
            ? OrganizationName
            : string.Join(" ", new[] { FirstName, LastName }.Where(value => !string.IsNullOrWhiteSpace(value)));
    public string SearchDisplay => $"{Name}{(string.IsNullOrWhiteSpace(Email) ? "" : $"  ·  {Email}")}{(DoNotMail ? "  ·  Do not mail" : "")}";
}

public sealed class TemplateDraft
{
    public string Name { get; init; } = "Untitled letter";
    public string Category { get; init; } = "GENERAL";
    public string Status { get; init; } = "DRAFT";
    public string PrintBody { get; init; } = "<p></p>";
    public object PrintLayoutJson { get; init; } = new { letterPdfLayout = new { version = 1, pageSize = "Letter (8.5 x 11 in)", margins = new { top = .75, right = .75, bottom = .75, left = .75 } } };
}

public sealed class BrandingSettings
{
    public string OrganizationDisplayName { get; init; } = "";
    public string LegalOrganizationName { get; init; } = "";
    public string Tagline { get; init; } = "";
    public string PrimaryColor { get; init; } = "#0B4A7C";
    public string AccentColor { get; init; } = "#1677C8";
    public string LogoUrl { get; init; } = "";
    public string LogoSquareUrl { get; init; } = "";
    public string StreetAddress1 { get; init; } = "";
    public string StreetAddress2 { get; init; } = "";
    public string City { get; init; } = "";
    public string StateProvince { get; init; } = "";
    public string PostalCode { get; init; } = "";
    public string ContactEmail { get; init; } = "";
    public string ContactPhone { get; init; } = "";
    public string WebsiteUrl { get; init; } = "";

    public string OrganizationName => string.IsNullOrWhiteSpace(OrganizationDisplayName) ? LegalOrganizationName : OrganizationDisplayName;
    public string AddressLine => string.Join(", ", new[]
    {
        string.Join(" ", new[] { StreetAddress1, StreetAddress2 }.Where(value => !string.IsNullOrWhiteSpace(value))),
        string.Join(" ", new[] { City, StateProvince, PostalCode }.Where(value => !string.IsNullOrWhiteSpace(value))),
    }.Where(value => !string.IsNullOrWhiteSpace(value)));
}

public sealed class PrintProject
{
    public string Id { get; init; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "Untitled letter";
    public string DocumentType { get; init; } = "Letter";
    public string? TemplateId { get; set; }
    public string ContentHtml { get; set; } = "<p>Dear {{donor.firstName}},</p><p>Thank you for your generous support.</p><p>With gratitude,</p>";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string DisplayMeta => $"{DocumentType}  ·  {UpdatedAt.ToLocalTime():MMM d, h:mm tt}";
}
