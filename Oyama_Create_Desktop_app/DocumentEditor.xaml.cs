using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;

namespace Oyama.Create.Desktop;

public partial class DocumentEditor : Window
{
    private readonly Letter original;
    private readonly Func<Letter, bool> save;
    private bool ready;
    private bool dirty;
    private bool updatingSelection;

    public DocumentEditor(Letter? letter, bool canSave, Func<Letter, bool> save)
    {
        this.original = letter ?? new Letter();
        this.save = save;
        InitializeComponent();
        DocumentTitle.Text = original.Title;
        new TextRange(Editor.Document.ContentStart, Editor.Document.ContentEnd).Text = original.Body;
        if (!string.IsNullOrEmpty(original.RichText))
        {
            try
            {
                using var stream = new MemoryStream(Convert.FromBase64String(original.RichText));
                new TextRange(Editor.Document.ContentStart, Editor.Document.ContentEnd).Load(stream, DataFormats.Rtf);
            }
            catch (Exception ex) when (ex is FormatException or ArgumentException or IOException)
            {
                MessageBox.Show(this, "The formatted version could not be loaded. The saved plain text is available. Save a copy after reviewing it.", "Formatting unavailable", MessageBoxButton.OK, MessageBoxImage.Warning);
                IsEnabled = false;
                Loaded += (_, _) => Close();
                return;
            }
        }
        PagePicker.SelectedIndex = original.PageSize == "A4" ? 1 : 0;
        MarginPicker.SelectedIndex = original.MarginInches == 0.5 ? 1 : original.MarginInches == 1.25 ? 2 : 0;
        ready = true;
        ApplyPage();
        dirty = letter is null;
        RefreshStatus();
        if (!canSave)
        {
            IsEnabled = false;
            Loaded += (_, _) => { MessageBox.Show(this, "The library is unavailable. Resolve its file access problem and restart before editing."); Close(); };
        }
        Closing += ConfirmClose;
        Loaded += (_, _) => Editor.Focus();
    }

    private void MarkDirty(object sender, TextChangedEventArgs e)
    {
        if (!ready) return;
        dirty = true;
        RefreshStatus();
    }

    private void ContentChanged(object sender, TextChangedEventArgs e)
    {
        if (!ready) return;
        dirty = true;
        RefreshStatus();
    }

    private void RefreshStatus()
    {
        var text = new TextRange(Editor.Document.ContentStart, Editor.Document.ContentEnd).Text;
        var words = text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length;
        DocumentStatus.Text = $"{words} words  ·  {(dirty ? "Unsaved changes" : "Local document")}  ·  Flow canvas";
        Title = $"{DocumentTitle.Text}{(dirty ? " *" : "")} · Oyama Create";
    }

    private void SaveDocument(object sender, RoutedEventArgs e)
    {
        if (!ready) return;
        if (string.IsNullOrWhiteSpace(DocumentTitle.Text))
        {
            MessageBox.Show(this, "Enter a document title before saving.", "Title required");
            DocumentTitle.Focus();
            return;
        }
        using var stream = new MemoryStream();
        var range = new TextRange(Editor.Document.ContentStart, Editor.Document.ContentEnd);
        range.Save(stream, DataFormats.Rtf);
        var updated = new Letter
        {
            Id = original.Id, Title = DocumentTitle.Text.Trim(), Body = range.Text,
            RichText = Convert.ToBase64String(stream.ToArray()),
            PageSize = PagePicker.SelectedIndex == 1 ? "A4" : "Letter",
            MarginInches = MarginPicker.SelectedIndex == 1 ? 0.5 : MarginPicker.SelectedIndex == 2 ? 1.25 : 1,
            Modified = DateTimeOffset.UtcNow
        };
        if (!save(updated)) return;
        dirty = false;
        RefreshStatus();
        DocumentStatus.Text = "Saved to your local library";
    }

    private void ConfirmClose(object? sender, CancelEventArgs e)
    {
        if (!dirty) return;
        var answer = MessageBox.Show(this, "Save changes before returning to your library?", "Unsaved document", MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
        if (answer == MessageBoxResult.Yes) SaveDocument(this, new RoutedEventArgs());
        e.Cancel = answer == MessageBoxResult.Cancel || (answer == MessageBoxResult.Yes && dirty);
    }

    private void BackToLibrary(object sender, RoutedEventArgs e) => Close();
    private void FocusText(object sender, RoutedEventArgs e) => Editor.Focus();
    private void ToggleInspector(object sender, RoutedEventArgs e)
    {
        var visible = Inspector.Visibility == Visibility.Visible;
        Inspector.Visibility = visible ? Visibility.Collapsed : Visibility.Visible;
        InspectorColumn.Width = new GridLength(visible ? 0 : 228);
    }

    private void ChangeFont(object sender, SelectionChangedEventArgs e)
    {
        if (!ready || updatingSelection || FontPicker.SelectedItem is not ComboBoxItem item) return;
        Editor.Selection.ApplyPropertyValue(TextElement.FontFamilyProperty, new FontFamily(item.Content.ToString()!));
        Editor.Focus();
    }

    private void ChangeFontSize(object sender, SelectionChangedEventArgs e)
    {
        if (!ready || updatingSelection || SizePicker.SelectedItem is not ComboBoxItem item) return;
        if (double.TryParse(item.Content.ToString(), CultureInfo.InvariantCulture, out var points))
            Editor.Selection.ApplyPropertyValue(TextElement.FontSizeProperty, points * 96 / 72);
        Editor.Focus();
    }

    private void SelectionChanged(object sender, RoutedEventArgs e)
    {
        if (!ready) return;
        updatingSelection = true;
        try
        {
            BoldButton.IsChecked = Editor.Selection.GetPropertyValue(TextElement.FontWeightProperty).Equals(FontWeights.Bold);
            ItalicButton.IsChecked = Editor.Selection.GetPropertyValue(TextElement.FontStyleProperty).Equals(FontStyles.Italic);
            var decorations = Editor.Selection.GetPropertyValue(Inline.TextDecorationsProperty) as TextDecorationCollection;
            UnderlineButton.IsChecked = decorations?.Contains(TextDecorations.Underline[0]) == true;
            var family = Editor.Selection.GetPropertyValue(TextElement.FontFamilyProperty) as FontFamily;
            FontPicker.SelectedItem = FontPicker.Items.Cast<ComboBoxItem>().FirstOrDefault(i => i.Content.ToString() == family?.Source);
            var size = Editor.Selection.GetPropertyValue(TextElement.FontSizeProperty);
            SizePicker.SelectedItem = SizePicker.Items.Cast<ComboBoxItem>().FirstOrDefault(i => size is double pixels && Math.Abs(double.Parse(i.Content.ToString()!, CultureInfo.InvariantCulture) - pixels * 72 / 96) < 0.1);
        }
        finally { updatingSelection = false; }
    }

    private void ChangeZoom(object sender, RoutedPropertyChangedEventArgs<double> e)
    {
        if (PageScale is null || ZoomLabel is null) return;
        PageScale.ScaleX = PageScale.ScaleY = e.NewValue / 100;
        ZoomLabel.Text = $"{e.NewValue:0}%";
    }

    private void ChangePage(object sender, SelectionChangedEventArgs e)
    {
        if (!ready) return;
        ApplyPage();
        dirty = true;
        RefreshStatus();
    }

    private void ApplyPage()
    {
        Paper.Width = PagePicker.SelectedIndex == 1 ? 793.7 : 816;
        Paper.MinHeight = Editor.MinHeight = PagePicker.SelectedIndex == 1 ? 1122.5 : 1056;
        Editor.Padding = new Thickness((MarginPicker.SelectedIndex == 1 ? 0.5 : MarginPicker.SelectedIndex == 2 ? 1.25 : 1) * 96);
    }
}


