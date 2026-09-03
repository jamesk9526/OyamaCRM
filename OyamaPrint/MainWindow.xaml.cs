using System.Diagnostics;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Microsoft.Win32;
using OyamaPrint.Models;
using OyamaPrint.Services;

namespace OyamaPrint;

public partial class MainWindow : Window
{
    private static readonly Regex MergeTokenPattern = new(@"\{\{[^{}]+\}\}", RegexOptions.Compiled);
    private readonly LettersApiClient _api;
    private readonly AuthUser _user;
    private readonly ProjectStore _projectStore;
    private readonly DispatcherTimer _saveTimer;
    private List<PrintProject> _projects = [];
    private List<LetterTemplateSummary> _templates = [];
    private readonly Dictionary<string, string> _serverTemplateBodies = new(StringComparer.Ordinal);
    private IReadOnlyList<MergeFieldSection> _mergeSections = [];
    private PrintProject? _activeProject;
    private BrandingSettings _branding = new();
    private ConstituentSummary? _selectedRecipient;
    private string? _selectedTemplateId;
    private bool _loadingDocument;
    private bool _showRulers = true;

    public MainWindow(LettersApiClient api, LoginResult session, ProjectStore? projectStore = null, bool initializeOnLoad = true)
    {
        _api = api;
        _user = session.User ?? throw new InvalidOperationException("An authenticated user is required.");
        _projectStore = projectStore ?? new ProjectStore();
        InitializeComponent();
        ConnectionStatusText.Text = "Connected to Oyama CRM";
        AccountButton.Content = string.IsNullOrWhiteSpace(_user.DisplayName) ? _user.Email : _user.DisplayName;
        _saveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(800) };
        _saveTimer.Tick += async (_, _) => await SaveActiveProjectAsync();
        if (initializeOnLoad) Loaded += async (_, _) => await InitializeWorkspaceAsync();
    }

    private async Task InitializeWorkspaceAsync()
    {
        _loadingDocument = true;
        try
        {
            DocumentStatusText.Text = "Loading your Oyama CRM workspace…";
            var projectsTask = _projectStore.LoadAsync();
            var templatesTask = _api.GetTemplatesAsync();
            var fieldsTask = _api.GetMergeFieldsAsync();
            var listsTask = _api.GetAudienceListsAsync();
            var brandingTask = _api.GetBrandingAsync();
            await Task.WhenAll(projectsTask, templatesTask, fieldsTask, listsTask, brandingTask);

            _projects = projectsTask.Result.OrderByDescending(project => project.UpdatedAt).ToList();
            _templates = templatesTask.Result.ToList();
            _mergeSections = fieldsTask.Result;
            _branding = brandingTask.Result;
            ProjectsList.ItemsSource = _projects;
            TemplatesList.ItemsSource = _templates;
            AudienceListsList.ItemsSource = listsTask.Result;
            PopulateMergeFields(_mergeSections);
            ApplyBranding();

            if (_projects.Count == 0) CreateProject("Donor thank-you letter");
            else ProjectsList.SelectedItem = _projects[0];
            DocumentStatusText.Text = $"Ready — {_templates.Count:N0} CRM templates and {listsTask.Result.Count:N0} audience lists loaded";
        }
        catch (Exception error)
        {
            DocumentStatusText.Text = $"Workspace partially loaded: {FriendlyMessage(error)}";
            if (_projects.Count == 0) CreateProject("Donor thank-you letter");
        }
        finally
        {
            _loadingDocument = false;
        }
    }

    private void ApplyBranding()
    {
        var organizationName = string.IsNullOrWhiteSpace(_branding.OrganizationName) ? "Your organization" : _branding.OrganizationName;
        DocumentOrganizationText.Text = organizationName.ToUpperInvariant();
        DocumentTaglineText.Text = _branding.Tagline;
        DocumentContactText.Text = string.Join("\n", new[] { _branding.AddressLine, _branding.ContactPhone, _branding.ContactEmail, _branding.WebsiteUrl }.Where(value => !string.IsNullOrWhiteSpace(value)));
        if (TryBrush(_branding.PrimaryColor, out var brush))
        {
            DocumentOrganizationText.Foreground = brush;
            Resources["OrganizationBrandBrush"] = brush;
        }

        var logoUri = _api.ResolveAssetUrl(string.IsNullOrWhiteSpace(_branding.LogoUrl) ? _branding.LogoSquareUrl : _branding.LogoUrl);
        if (logoUri is null) return;
        try
        {
            var image = new BitmapImage();
            image.BeginInit();
            image.UriSource = logoUri;
            image.CacheOption = BitmapCacheOption.OnLoad;
            image.EndInit();
            DocumentLogoImage.Source = image;
        }
        catch
        {
            DocumentLogoImage.Source = null;
        }
    }

    private void CreateProject(string name, string? content = null, string? templateId = null)
    {
        var project = new PrintProject { Name = name, ContentHtml = content ?? new PrintProject().ContentHtml, TemplateId = templateId };
        _projects.Insert(0, project);
        RefreshProjects();
        ProjectsList.SelectedItem = project;
    }

    private void NewButton_Click(object sender, RoutedEventArgs e) => CreateProject($"Untitled letter {_projects.Count + 1}");

    private void ProjectsList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (ProjectsList.SelectedItem is not PrintProject project || ReferenceEquals(project, _activeProject)) return;
        _saveTimer.Stop();
        if (_activeProject is not null) CaptureActiveProject();
        _activeProject = project;
        _selectedTemplateId = project.TemplateId;
        _loadingDocument = true;
        TemplateNameBox.Text = project.Name;
        HtmlDocumentCodec.LoadHtml(Editor.Document, project.ContentHtml);
        _loadingDocument = false;
        WindowDocumentTitle.Text = project.Name;
        DocumentStatusText.Text = $"Opened {project.Name}";
        RunPreflight();
    }

    private async void TemplatesList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (TemplatesList.SelectedItem is not LetterTemplateSummary selected) return;
        await OpenTemplateAsync(selected);
    }

    private async Task OpenTemplateAsync(LetterTemplateSummary selected)
    {
        try
        {
            DocumentStatusText.Text = $"Opening CRM template {selected.Name}…";
            var detail = await _api.GetTemplateAsync(selected.Id);
            _serverTemplateBodies[detail.Id] = detail.PrintBody;
            var existing = _projects.FirstOrDefault(project => project.TemplateId == detail.Id);
            if (existing is not null) ProjectsList.SelectedItem = existing;
            else CreateProject(detail.Name, detail.PrintBody, detail.Id);
            DocumentStatusText.Text = $"{detail.Name} is open as a local print project";
        }
        catch (Exception error)
        {
            DocumentStatusText.Text = $"Could not open template: {FriendlyMessage(error)}";
        }
    }

    private void Editor_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (_loadingDocument || _activeProject is null) return;
        DocumentStatusText.Text = "Editing — local auto-save pending";
        _saveTimer.Stop();
        _saveTimer.Start();
        RunPreflight();
    }

    private void TemplateNameBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (_loadingDocument || _activeProject is null) return;
        _activeProject.Name = string.IsNullOrWhiteSpace(TemplateNameBox.Text) ? "Untitled letter" : TemplateNameBox.Text.Trim();
        WindowDocumentTitle.Text = _activeProject.Name;
        _saveTimer.Stop();
        _saveTimer.Start();
    }

    private async Task SaveActiveProjectAsync()
    {
        _saveTimer.Stop();
        if (_activeProject is null) return;
        CaptureActiveProject();
        await _projectStore.SaveAsync(_projects);
        RefreshProjects();
        DocumentStatusText.Text = $"Saved locally at {DateTime.Now:h:mm tt}";
    }

    private async void SaveProjectButton_Click(object sender, RoutedEventArgs e) => await SaveActiveProjectAsync();

    private async void SaveTemplateButton_Click(object sender, RoutedEventArgs e)
    {
        if (_activeProject is null) return;
        try
        {
            await SaveActiveProjectAsync();
            DocumentStatusText.Text = "Syncing template with Oyama CRM…";
            var saved = await _api.SaveTemplateAsync(_selectedTemplateId, new TemplateDraft { Name = _activeProject.Name, PrintBody = _activeProject.ContentHtml });
            _selectedTemplateId = saved.Id;
            _activeProject.TemplateId = saved.Id;
            _serverTemplateBodies[saved.Id] = _activeProject.ContentHtml;
            await _projectStore.SaveAsync(_projects);
            await RefreshTemplatesAsync();
            DocumentStatusText.Text = $"{saved.Name} synced with Oyama CRM";
        }
        catch (Exception error) { DocumentStatusText.Text = $"Template sync failed: {FriendlyMessage(error)}"; }
    }

    private void CaptureActiveProject()
    {
        if (_activeProject is null) return;
        _activeProject.Name = string.IsNullOrWhiteSpace(TemplateNameBox.Text) ? "Untitled letter" : TemplateNameBox.Text.Trim();
        _activeProject.ContentHtml = HtmlDocumentCodec.ToHtml(Editor.Document);
        _activeProject.TemplateId = _selectedTemplateId;
        _activeProject.UpdatedAt = DateTime.UtcNow;
    }

    private void RefreshProjects()
    {
        var selected = _activeProject;
        var search = ProjectSearchBox?.Text.Trim() ?? "";
        ProjectsList.ItemsSource = string.IsNullOrWhiteSpace(search) ? _projects : _projects.Where(project => project.Name.Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();
        ProjectsList.SelectedItem = selected;
    }

    private void ProjectSearchBox_TextChanged(object sender, TextChangedEventArgs e) => RefreshProjects();
    private void ShowRecentButton_Click(object sender, RoutedEventArgs e) { ProjectSearchBox.Text = ""; ProjectsList.ItemsSource = _projects.OrderByDescending(project => project.UpdatedAt).ToList(); }

    private async void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            await RefreshTemplatesAsync();
            DocumentStatusText.Text = "CRM templates refreshed";
        }
        catch (Exception error) { DocumentStatusText.Text = $"Refresh failed: {FriendlyMessage(error)}"; }
    }

    private async Task RefreshTemplatesAsync()
    {
        _templates = (await _api.GetTemplatesAsync()).ToList();
        TemplatesList.ItemsSource = _templates;
    }

    private void PopulateMergeFields(IEnumerable<MergeFieldSection> sections)
    {
        MergeFieldsTree.ItemsSource = sections.Select(section => new TreeViewItem
        {
            Header = section.Label,
            IsExpanded = true,
            ItemsSource = section.Fields.Select(field => new TreeViewItem { Header = FriendlyFieldName(field), Tag = field }).ToList(),
        }).ToList();
    }

    private void FieldSearchBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        var query = FieldSearchBox.Text.Trim();
        PopulateMergeFields(string.IsNullOrWhiteSpace(query) ? _mergeSections : _mergeSections.Select(section => new MergeFieldSection { Key = section.Key, Label = section.Label, Fields = section.Fields.Where(field => field.Contains(query, StringComparison.OrdinalIgnoreCase) || FriendlyFieldName(field).Contains(query, StringComparison.OrdinalIgnoreCase)).ToList() }).Where(section => section.Fields.Count > 0));
    }

    private void InsertSelectedField_Click(object sender, RoutedEventArgs e)
    {
        if (MergeFieldsTree.SelectedItem is TreeViewItem { Tag: string field }) InsertMergeField(field);
        else DocumentStatusText.Text = "Select a merge field first";
    }

    private void MergeFieldsTree_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (MergeFieldsTree.SelectedItem is TreeViewItem { Tag: string field }) InsertMergeField(field);
    }

    private void MergeFieldsTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (e.NewValue is TreeViewItem { Tag: string field }) DocumentStatusText.Text = $"Selected {FriendlyFieldName(field)}";
    }

    private void InsertMergeField(string field)
    {
        Editor.Focus();
        Editor.CaretPosition.InsertTextInRun(field.StartsWith("{{", StringComparison.Ordinal) ? field : $"{{{{{field}}}}}");
        DocumentStatusText.Text = $"Inserted {FriendlyFieldName(field)}";
    }

    private void RunPreflight_Click(object sender, RoutedEventArgs e) => RunPreflight();

    private void RunPreflight()
    {
        var text = new TextRange(Editor.Document.ContentStart, Editor.Document.ContentEnd).Text;
        var tokens = MergeTokenPattern.Matches(text).Cast<Match>().Select(match => match.Value).Distinct().ToList();
        var supported = _mergeSections.SelectMany(section => section.Fields).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var unsupported = tokens.Where(token => !supported.Contains(token)).ToList();
        if (string.IsNullOrWhiteSpace(text))
        {
            PreflightText.Text = "Document is empty";
            PreflightText.Foreground = Brushes.Firebrick;
        }
        else if (unsupported.Count > 0)
        {
            PreflightText.Text = $"⚠ {unsupported.Count} unsupported merge field{(unsupported.Count == 1 ? "" : "s")}: {string.Join(", ", unsupported.Take(3))}";
            PreflightText.Foreground = Brushes.Firebrick;
        }
        else
        {
            PreflightText.Text = tokens.Count == 0 ? "✓ Document ready" : $"✓ {tokens.Count} merge field{(tokens.Count == 1 ? "" : "s")} ready for recipient data";
            PreflightText.Foreground = new SolidColorBrush(Color.FromRgb(24, 117, 60));
        }
    }

    private void AudienceListsList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (AudienceListsList.SelectedItem is AudienceList list) DocumentStatusText.Text = $"Audience selected: {list.Name} ({list.RecipientsCount:N0} recipients)";
    }

    private void ShowAudienceButton_Click(object sender, RoutedEventArgs e) { AudienceExpander.IsExpanded = true; AudienceListsList.Focus(); }

    private async void SearchRecipientsButton_Click(object sender, RoutedEventArgs e) => await SearchRecipientsAsync();

    private async void RecipientSearchBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) { e.Handled = true; await SearchRecipientsAsync(); }
    }

    private async Task SearchRecipientsAsync()
    {
        var query = RecipientSearchBox.Text.Trim();
        if (query.Length < 2) { DocumentStatusText.Text = "Enter at least two characters to search CRM constituents"; return; }
        try
        {
            DocumentStatusText.Text = "Searching CRM constituents…";
            var results = await _api.SearchConstituentsAsync(query);
            RecipientResultsBox.ItemsSource = results;
            RecipientResultsBox.Visibility = Visibility.Visible;
            RecipientResultsBox.IsDropDownOpen = true;
            DocumentStatusText.Text = results.Count == 0 ? "No matching constituents found" : $"Found {results.Count} matching constituent{(results.Count == 1 ? "" : "s")}";
        }
        catch (Exception error) { DocumentStatusText.Text = $"Recipient search failed: {FriendlyMessage(error)}"; }
    }

    private void RecipientResultsBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        _selectedRecipient = RecipientResultsBox.SelectedItem as ConstituentSummary;
        if (_selectedRecipient is not null) DocumentStatusText.Text = _selectedRecipient.DoNotMail ? $"{_selectedRecipient.Name} is marked Do not mail" : $"Preview recipient: {_selectedRecipient.Name}";
    }

    private async void PrintPreviewButton_Click(object sender, RoutedEventArgs e)
    {
        var output = await GetOutputDocumentAsync();
        if (output is not null) new PrintPreviewWindow(LocalPdfRenderer.CreatePrintableDocument(output, _branding, DocumentLogoImage.Source)) { Owner = this }.Show();
    }

    private async void PrintButton_Click(object sender, RoutedEventArgs e)
    {
        var output = await GetOutputDocumentAsync();
        if (output is null) return;
        var dialog = new PrintDialog();
        if (dialog.ShowDialog() != true) return;
        var printable = LocalPdfRenderer.CreatePrintableDocument(output, _branding, DocumentLogoImage.Source);
        printable.PageWidth = dialog.PrintableAreaWidth;
        printable.PageHeight = dialog.PrintableAreaHeight;
        dialog.PrintDocument(((IDocumentPaginatorSource)printable).DocumentPaginator, TemplateNameBox.Text.Trim());
    }

    private async void LocalPdfButton_Click(object sender, RoutedEventArgs e)
    {
        var output = await GetOutputDocumentAsync();
        if (output is null) return;
        var dialog = new SaveFileDialog
        {
            Title = "Export local PDF",
            Filter = "PDF document (*.pdf)|*.pdf",
            FileName = SafeFileName(TemplateNameBox.Text) + ".pdf",
            AddExtension = true,
            DefaultExt = ".pdf",
        };
        if (dialog.ShowDialog(this) != true) return;
        try
        {
            DocumentStatusText.Text = "Rendering PDF on this computer…";
            LocalPdfRenderer.Save(output, _branding, DocumentLogoImage.Source, dialog.FileName);
            DocumentStatusText.Text = $"PDF saved locally: {dialog.FileName}";
            Process.Start(new ProcessStartInfo(dialog.FileName) { UseShellExecute = true });
        }
        catch (Exception error)
        {
            DocumentStatusText.Text = $"PDF export failed: {FriendlyMessage(error)}";
            MessageBox.Show(this, FriendlyMessage(error), "PDF export failed", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void MergedPreviewButton_Click(object sender, RoutedEventArgs e)
    {
        var output = await GetOutputDocumentAsync(requireRecipient: true);
        if (output is not null) new PrintPreviewWindow(LocalPdfRenderer.CreatePrintableDocument(output, _branding, DocumentLogoImage.Source)) { Owner = this }.Show();
    }

    private async Task<FlowDocument?> GetOutputDocumentAsync(bool requireRecipient = false)
    {
        var recipientId = _selectedRecipient?.Id ?? "";
        if (string.IsNullOrWhiteSpace(recipientId))
        {
            if (requireRecipient)
            {
                DocumentStatusText.Text = "Search for and select a CRM recipient for a merged preview";
                return null;
            }
            return (FlowDocument)XamlReader.Parse(XamlWriter.Save(Editor.Document));
        }
        if (string.IsNullOrWhiteSpace(_selectedTemplateId))
        {
            DocumentStatusText.Text = "Sync this project as a CRM template before resolving recipient merge fields";
            return null;
        }
        CaptureActiveProject();
        if (_activeProject is not null && (!_serverTemplateBodies.TryGetValue(_selectedTemplateId, out var serverBody) || !string.Equals(serverBody, _activeProject.ContentHtml, StringComparison.Ordinal)))
        {
            DocumentStatusText.Text = "Sync this project's latest changes to its CRM template before resolving recipient fields";
            return null;
        }
        try
        {
            DocumentStatusText.Text = "Retrieving permissioned merge data from Oyama CRM…";
            var preview = await _api.GetMergedPreviewAsync(_selectedTemplateId, recipientId);
            var document = new FlowDocument();
            HtmlDocumentCodec.LoadHtml(document, preview.MergedPrintBody);
            var issueCount = preview.MissingFields.Count + preview.UnsupportedFields.Count;
            DocumentStatusText.Text = issueCount == 0 ? "Recipient fields resolved — output will render locally" : $"Merged preview has {issueCount} unresolved field(s)";
            return document;
        }
        catch (Exception error)
        {
            DocumentStatusText.Text = $"Could not resolve recipient data: {FriendlyMessage(error)}";
            return null;
        }
    }

    private async void AccountButton_Click(object sender, RoutedEventArgs e)
    {
        if (MessageBox.Show(this, "Sign out and forget the saved Oyama CRM session on this computer?", "Sign out", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        await _api.LogoutAsync();
        Application.Current.Shutdown();
    }

    private void FontFamilyBox_SelectionChanged(object sender, SelectionChangedEventArgs e) { if (IsLoaded && FontFamilyBox.SelectedItem is ComboBoxItem { Content: string font }) Editor.Selection.ApplyPropertyValue(TextElement.FontFamilyProperty, new FontFamily(font)); }
    private void FontSizeBox_SelectionChanged(object sender, SelectionChangedEventArgs e) { if (IsLoaded && FontSizeBox.SelectedItem is ComboBoxItem { Content: string value } && double.TryParse(value, out var size)) Editor.Selection.ApplyPropertyValue(TextElement.FontSizeProperty, size); }
    private void BoldButton_Click(object sender, RoutedEventArgs e) => EditingCommands.ToggleBold.Execute(null, Editor);
    private void ItalicButton_Click(object sender, RoutedEventArgs e) => EditingCommands.ToggleItalic.Execute(null, Editor);
    private void UnderlineButton_Click(object sender, RoutedEventArgs e) => EditingCommands.ToggleUnderline.Execute(null, Editor);
    private void AlignLeft_Click(object sender, RoutedEventArgs e) => Editor.Selection.ApplyPropertyValue(Paragraph.TextAlignmentProperty, TextAlignment.Left);
    private void AlignCenter_Click(object sender, RoutedEventArgs e) => Editor.Selection.ApplyPropertyValue(Paragraph.TextAlignmentProperty, TextAlignment.Center);
    private void AlignRight_Click(object sender, RoutedEventArgs e) => Editor.Selection.ApplyPropertyValue(Paragraph.TextAlignmentProperty, TextAlignment.Right);
    private void Bullets_Click(object sender, RoutedEventArgs e) => EditingCommands.ToggleBullets.Execute(null, Editor);
    private void NumberingButton_Click(object sender, RoutedEventArgs e) => EditingCommands.ToggleNumbering.Execute(null, Editor);
    private void JustifyButton_Click(object sender, RoutedEventArgs e) => Editor.Selection.ApplyPropertyValue(Paragraph.TextAlignmentProperty, TextAlignment.Justify);
    private void IncreaseFontButton_Click(object sender, RoutedEventArgs e) => ChangeFontSize(1);
    private void DecreaseFontButton_Click(object sender, RoutedEventArgs e) => ChangeFontSize(-1);
    private void StrikeButton_Click(object sender, RoutedEventArgs e) => Editor.Selection.ApplyPropertyValue(Inline.TextDecorationsProperty, TextDecorations.Strikethrough);
    private void HighlightButton_Click(object sender, RoutedEventArgs e) => Editor.Selection.ApplyPropertyValue(TextElement.BackgroundProperty, new SolidColorBrush(Color.FromRgb(255, 241, 118)));
    private void ClearFormattingButton_Click(object sender, RoutedEventArgs e) => Editor.Selection.ClearAllProperties();
    private void IncreaseIndentButton_Click(object sender, RoutedEventArgs e) => ChangeIndent(18);
    private void DecreaseIndentButton_Click(object sender, RoutedEventArgs e) => ChangeIndent(-18);
    private void NormalStyleButton_Click(object sender, RoutedEventArgs e) => ApplyParagraphStyle(11, FontWeights.Normal);
    private void Heading1StyleButton_Click(object sender, RoutedEventArgs e) => ApplyParagraphStyle(18, FontWeights.Bold);
    private void Heading2StyleButton_Click(object sender, RoutedEventArgs e) => ApplyParagraphStyle(14, FontWeights.SemiBold);
    private void TitleStyleButton_Click(object sender, RoutedEventArgs e) => ApplyParagraphStyle(24, FontWeights.SemiBold);
    private void RecipientBlockButton_Click(object sender, RoutedEventArgs e) => InsertText("{{donor.fullName}}\n{{donor.addressBlock}}");
    private void OrganizationFieldButton_Click(object sender, RoutedEventArgs e) => InsertMergeField("{{organization.name}}");
    private void StaffSignatureButton_Click(object sender, RoutedEventArgs e) => InsertText("{{staff.fullName}}\n{{staff.title}}\n{{staff.email}}");
    private void PageBreak_Click(object sender, RoutedEventArgs e)
    {
        var paragraph = Editor.CaretPosition.Paragraph;
        var pageStart = new Paragraph { BreakPageBefore = true, Margin = new Thickness(0, 0, 0, 10) };
        if (paragraph is not null) Editor.Document.Blocks.InsertAfter(paragraph, pageStart);
        else Editor.Document.Blocks.Add(pageStart);
        Editor.CaretPosition = pageStart.ContentStart;
        Editor.Focus();
    }
    private void Date_Click(object sender, RoutedEventArgs e) => Editor.CaretPosition.InsertTextInRun(DateTime.Today.ToLongDateString());
    private void Rulers_Click(object sender, RoutedEventArgs e) { _showRulers = !_showRulers; RulerText.Visibility = _showRulers ? Visibility.Visible : Visibility.Collapsed; }

    private void ChangeFontSize(double delta)
    {
        var value = Editor.Selection.GetPropertyValue(TextElement.FontSizeProperty);
        var current = value is double size ? size : Editor.FontSize;
        Editor.Selection.ApplyPropertyValue(TextElement.FontSizeProperty, Math.Clamp(current + delta, 6, 72));
    }

    private void ChangeIndent(double delta)
    {
        var value = Editor.Selection.GetPropertyValue(Paragraph.MarginProperty);
        var margin = value is Thickness thickness ? thickness : new Thickness(0);
        Editor.Selection.ApplyPropertyValue(Paragraph.MarginProperty, new Thickness(Math.Max(0, margin.Left + delta), margin.Top, margin.Right, margin.Bottom));
    }

    private void ApplyParagraphStyle(double size, FontWeight weight)
    {
        Editor.Selection.ApplyPropertyValue(TextElement.FontSizeProperty, size);
        Editor.Selection.ApplyPropertyValue(TextElement.FontWeightProperty, weight);
        Editor.Selection.ApplyPropertyValue(Paragraph.MarginProperty, new Thickness(0, 0, 0, size >= 18 ? 12 : 8));
    }

    private void InsertText(string text)
    {
        Editor.Focus();
        Editor.CaretPosition.InsertTextInRun(text);
    }

    private void DuplicateProjectMenu_Click(object sender, RoutedEventArgs e)
    {
        if (ProjectsList.SelectedItem is not PrintProject project) return;
        CreateProject(project.Name + " (Copy)", project.ContentHtml, project.TemplateId);
    }

    private async void DeleteProjectMenu_Click(object sender, RoutedEventArgs e)
    {
        if (ProjectsList.SelectedItem is not PrintProject project) return;
        if (MessageBox.Show(this, $"Delete the local project '{project.Name}'? CRM templates are not affected.", "Delete project", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        _projects.Remove(project);
        _activeProject = null;
        await _projectStore.SaveAsync(_projects);
        RefreshProjects();
        if (_projects.Count > 0) ProjectsList.SelectedItem = _projects[0]; else CreateProject("Untitled letter");
    }

    private async void OpenTemplateMenu_Click(object sender, RoutedEventArgs e)
    {
        if (TemplatesList.SelectedItem is not LetterTemplateSummary template) return;
        await OpenTemplateAsync(template);
    }

    private async void DuplicateTemplateMenu_Click(object sender, RoutedEventArgs e)
    {
        if (TemplatesList.SelectedItem is not LetterTemplateSummary template) return;
        try { var copy = await _api.DuplicateTemplateAsync(template.Id); await RefreshTemplatesAsync(); DocumentStatusText.Text = $"Created {copy.Name}"; }
        catch (Exception error) { DocumentStatusText.Text = $"Could not duplicate template: {FriendlyMessage(error)}"; }
    }

    private async void PublishTemplateMenu_Click(object sender, RoutedEventArgs e)
    {
        if (TemplatesList.SelectedItem is not LetterTemplateSummary template) return;
        if (MessageBox.Show(this, $"Run CRM preflight and publish '{template.Name}'?", "Publish template", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        try { await _api.PublishTemplateAsync(template.Id); await RefreshTemplatesAsync(); DocumentStatusText.Text = $"Published {template.Name}"; }
        catch (Exception error) { DocumentStatusText.Text = FriendlyMessage(error); }
    }

    private async void ArchiveTemplateMenu_Click(object sender, RoutedEventArgs e)
    {
        if (TemplatesList.SelectedItem is not LetterTemplateSummary template) return;
        if (MessageBox.Show(this, $"Archive the CRM template '{template.Name}'?", "Archive template", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        try { await _api.ArchiveTemplateAsync(template.Id); await RefreshTemplatesAsync(); DocumentStatusText.Text = $"Archived {template.Name}"; }
        catch (Exception error) { DocumentStatusText.Text = $"Could not archive template: {FriendlyMessage(error)}"; }
    }

    private static string FriendlyFieldName(string field)
    {
        var value = field.Trim('{', '}').Replace('.', ' ').Replace('_', ' ');
        return Regex.Replace(value, "([a-z])([A-Z])", "$1 $2");
    }
    private static string FriendlyMessage(Exception error) => FriendlyMessage(error.Message);
    private static string FriendlyMessage(string message) => message.Length > 220 ? message[..220] + "…" : message;
    private static string SafeFileName(string value) => string.Concat((string.IsNullOrWhiteSpace(value) ? "OyamaPrint document" : value).Select(character => Path.GetInvalidFileNameChars().Contains(character) ? '_' : character));
    private static bool TryBrush(string value, out SolidColorBrush brush)
    {
        try { brush = new SolidColorBrush((Color)ColorConverter.ConvertFromString(value)); return true; }
        catch { brush = new SolidColorBrush(Color.FromRgb(18, 100, 163)); return false; }
    }
}
