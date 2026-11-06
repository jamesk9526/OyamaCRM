using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Automation;
using System.Windows.Media;
using System.Windows.Media.Effects;
using Microsoft.Win32;

namespace Oyama.Create.Desktop;

public partial class MainWindow : Window
{
    private readonly string libraryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Oyama", "Create", "letters.json");
    private List<Letter> letters = [];
    private bool libraryLoaded;

    public MainWindow()
    {
        InitializeComponent();
        try
        {
            if (File.Exists(libraryPath))
                letters = JsonSerializer.Deserialize<List<Letter>>(File.ReadAllText(libraryPath))
                    ?? throw new InvalidDataException("The library is empty or invalid.");
            if (letters.Any(l => l is null || l.Title is null || l.Body is null))
                throw new InvalidDataException("A letter contains invalid data.");
            libraryLoaded = true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            MessageBox.Show(this, $"Your library could not be loaded. Existing data will not be overwritten.\n\n{ex.Message}", "Library unavailable", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        RenderCards();
    }

    private void NewDocument(object sender, RoutedEventArgs e) => EditLetter(null);

    private void ImportDocument(object sender, RoutedEventArgs e)
    {
        var picker = new OpenFileDialog { Filter = "Text documents (*.txt)|*.txt", Title = "Open a letter" };
        if (picker.ShowDialog(this) != true) return;
        try
        {
            var info = new FileInfo(picker.FileName);
            if (info.Length > 2_000_000) throw new IOException("Please choose a text file smaller than 2 MB.");
            EditLetter(new Letter { Title = Path.GetFileNameWithoutExtension(picker.FileName), Body = File.ReadAllText(picker.FileName) });
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            MessageBox.Show(this, ex.Message, "Could not open letter", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void RenderCards()
    {
        Cards.Children.Clear();
        EmptyState.Visibility = letters.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
        foreach (var letter in letters.OrderByDescending(l => l.Modified))
        {
            var panel = new StackPanel();
            var paper = new Border { Background = Brushes.White, Width = 152, Height = 190, Padding = new Thickness(17), Margin = new Thickness(0,18,0,18), Effect = new DropShadowEffect { BlurRadius = 10, ShadowDepth = 2, Opacity = 0.12 } };
            paper.Child = new TextBlock { Text = letter.Body.Length == 0 ? "Blank letter" : letter.Body[..Math.Min(letter.Body.Length, 650)], FontFamily = new FontFamily("Georgia"), FontSize = 6.5, Foreground = Brushes.DimGray, TextWrapping = TextWrapping.Wrap, ClipToBounds = true };
            panel.Children.Add(new Border { Background = new SolidColorBrush(Color.FromRgb(239,242,247)), Child = paper, CornerRadius = new CornerRadius(8,8,0,0) });
            var details = new StackPanel { Margin = new Thickness(16) };
            details.Children.Add(new TextBlock { Text = letter.Title, FontWeight = FontWeights.SemiBold, FontSize = 15, TextTrimming = TextTrimming.CharacterEllipsis, ToolTip = letter.Title });
            details.Children.Add(new TextBlock { Text = $"Letter · {letter.Modified.ToLocalTime():MMM d, yyyy}", Foreground = Brushes.SlateGray, FontSize = 12, Margin = new Thickness(0,6,0,14) });
            var open = new Button { Content = "Open letter", HorizontalAlignment = HorizontalAlignment.Stretch };
            open.Click += (_, _) => EditLetter(letter);
            AutomationProperties.SetName(open, $"Open {letter.Title}");
            details.Children.Add(open);
            panel.Children.Add(details);
            Cards.Children.Add(new Border { Width = 240, Margin = new Thickness(0,0,20,20), Background = Brushes.White, BorderBrush = new SolidColorBrush(Color.FromRgb(224,229,236)), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(9), Child = panel, Effect = new DropShadowEffect { BlurRadius = 12, ShadowDepth = 2, Opacity = 0.04 } });
        }
        Status.Text = libraryLoaded ? $"{letters.Count} letters · Local library · Saved on this computer" : "Library unavailable · Restart after resolving the file access problem";
    }

    private void EditLetter(Letter? original)
    {
        var editor = new DocumentEditor(original, libraryLoaded, updated =>
        {
            var next = letters.Where(l => l.Id != updated.Id).Append(updated).ToList();
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(libraryPath)!);
                var temporary = libraryPath + ".tmp";
                File.WriteAllText(temporary, JsonSerializer.Serialize(next));
                File.Move(temporary, libraryPath, true);
                letters = next;
                RenderCards();
                return true;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                MessageBox.Show(this, $"Your letter could not be saved. Keep the editor open and try again.\n\n{ex.Message}", "Save failed", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
        }) { Owner = this };
        editor.ShowDialog();
    }
}

public sealed class Letter
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "Untitled letter";
    public string Body { get; set; } = "";
    public string? RichText { get; set; }
    public string PageSize { get; set; } = "Letter";
    public double MarginInches { get; set; } = 1;
    public DateTimeOffset Modified { get; set; } = DateTimeOffset.UtcNow;
}



