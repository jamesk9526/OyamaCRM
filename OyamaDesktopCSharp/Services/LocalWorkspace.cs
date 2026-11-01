using System.IO;
namespace OyamaDesktop.Services;
public static class LocalWorkspace {
 public static async Task<string> ReadPreviewAsync(string path) {
 var info=new FileInfo(path); if(info.Length>2*1024*1024) throw new InvalidOperationException("Preview supports files up to 2 MB.");
 if(!new[]{".txt",".csv",".json",".md",".log"}.Contains(info.Extension.ToLowerInvariant())) throw new InvalidOperationException("Choose a text, CSV, JSON, Markdown, or log file.");
 return await File.ReadAllTextAsync(path);
 }
}
