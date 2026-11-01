namespace OyamaDesktop.Models;
public sealed record WorkspaceModule(string Id, string Title, string? ApiPath);
public static class SuiteModules {
 public static IReadOnlyList<WorkspaceModule> All { get; } = [new("contacts", "Contacts", "constituents"), new("donations", "Donations", "donations"), new("tasks", "Tasks", "tasks"), new("files", "Local files", null)];
}
