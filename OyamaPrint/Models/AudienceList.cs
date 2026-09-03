namespace OyamaPrint.Models;

public sealed record AudienceList(string Id, string Name, int RecipientsCount, string? Description)
{
    public string DisplayName => $"{Name} ({RecipientsCount:N0})";
}

public sealed record LoginResult(string? AccessToken, AuthUser? User, bool MfaRequired, string? MfaTicket, string? DestinationHint)
{
    public bool IsAuthenticated => !string.IsNullOrWhiteSpace(AccessToken);
    public string UserName => User?.DisplayName ?? "Oyama user";
}

public sealed record AuthUser(string Id, string Email, string FirstName, string LastName, string Role, string OrganizationId)
{
    public string DisplayName => string.Join(" ", new[] { FirstName, LastName }.Where(value => !string.IsNullOrWhiteSpace(value)));
}
