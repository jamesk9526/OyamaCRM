using System.IO;
using System.Text.Json;
using OyamaPrint.Models;

namespace OyamaPrint.Services;

public sealed class ProjectStore
{
    private readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string _filePath;

    public ProjectStore(string? storageFolder = null)
    {
        var folder = storageFolder ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OyamaCRM", "OyamaPrint");
        Directory.CreateDirectory(folder);
        _filePath = Path.Combine(folder, "projects.json");
    }

    public async Task<List<PrintProject>> LoadAsync()
    {
        if (!File.Exists(_filePath)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<PrintProject>>(await File.ReadAllTextAsync(_filePath), _json) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public Task SaveAsync(IReadOnlyCollection<PrintProject> projects) =>
        File.WriteAllTextAsync(_filePath, JsonSerializer.Serialize(projects, _json));
}
