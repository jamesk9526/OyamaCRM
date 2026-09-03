using System.IO;
using System.Windows;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using OyamaPrint;
using OyamaPrint.Models;
using OyamaPrint.Services;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        var output = args.Length > 0 ? Path.GetFullPath(args[0]) : Path.GetFullPath("artifacts/visual-smoke");
        Directory.CreateDirectory(output);
        var application = new Application();
        application.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        application.Resources.MergedDictionaries.Add(new ResourceDictionary
        {
            Source = new Uri("pack://application:,,,/OyamaPrint;component/Themes/OyamaStyles.xaml", UriKind.Absolute),
        });
        var api = new LettersApiClient();
        api.Configure("https://www.crm.partnertpcc.com");

        Render(new LoginWindow(api), Path.Combine(output, "login.png"), 900, 570);
        Render(new LoginWindow(api), Path.Combine(output, "login-narrow.png"), 760, 520);

        var user = new AuthUser("visual-smoke", "user@example.org", "Elena", "Rodriguez", "admin", "test-org");
        var main = new MainWindow(api, new LoginResult("visual-smoke-token", user, false, null, null), new ProjectStore(output), initializeOnLoad: false);
        var editor = (System.Windows.Controls.RichTextBox)main.FindName("Editor");
        HtmlDocumentCodec.LoadHtml(editor.Document, "<p>Dear {{donor.firstName}},</p><p>Thank you for your generous support. Your gift helps strengthen our community and makes lasting work possible.</p><p>With heartfelt thanks,</p><p><strong>Elena Rodriguez</strong><br />Executive Director</p>");
        ((System.Windows.Controls.TextBox)main.FindName("TemplateNameBox")).Text = "Donor thank-you letter";
        ((System.Windows.Controls.TextBlock)main.FindName("DocumentOrganizationText")).Text = "OYAMA COMMUNITY FOUNDATION";
        ((System.Windows.Controls.TextBlock)main.FindName("DocumentTaglineText")).Text = "Building a stronger community together";
        ((System.Windows.Controls.TextBlock)main.FindName("DocumentContactText")).Text = "123 Community Way\nPortland, OR 97201\n503-555-0198\nhello@example.org";
        Render(main, Path.Combine(output, "workspace.png"), 1440, 820);
        var narrowMain = new MainWindow(api, new LoginResult("visual-smoke-token", user, false, null, null), new ProjectStore(output), initializeOnLoad: false);
        Render(narrowMain, Path.Combine(output, "workspace-narrow.png"), 1100, 720);

        var document = new FlowDocument(new Paragraph(new Run("Dear {{donor.firstName}},\n\nThank you for your generous support. Your gift helps strengthen our community.\n\nWith gratitude,\n\nElena Rodriguez\nExecutive Director")))
        {
            FontFamily = new FontFamily("Aptos"),
            FontSize = 11,
        };
        var branding = new BrandingSettings { OrganizationDisplayName = "Oyama Community Foundation", Tagline = "Building a stronger community together", PrimaryColor = "#1264A3", StreetAddress1 = "123 Community Way", City = "Portland", StateProvince = "OR", PostalCode = "97201", ContactPhone = "503-555-0198", ContactEmail = "hello@example.org" };
        LocalPdfRenderer.Save(document, branding, null, Path.Combine(output, "local-pdf-smoke.pdf"));
        Console.WriteLine(output);
        application.Shutdown();
    }

    private static void Render(Window window, string path, double width, double height)
    {
        window.Width = width;
        window.Height = height;
        window.Show();
        window.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.ApplicationIdle);
        window.UpdateLayout();
        var visual = (FrameworkElement)window.Content;
        var bitmap = new RenderTargetBitmap((int)Math.Ceiling(visual.ActualWidth), (int)Math.Ceiling(visual.ActualHeight), 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(visual);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var stream = File.Create(path);
        encoder.Save(stream);
        window.Close();
    }
}
