using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using OyamaPrint.Models;
using PdfSharp.Drawing;
using PdfSharp.Pdf;

namespace OyamaPrint.Services;

public static class LocalPdfRenderer
{
    private const double PageWidth = 816;
    private const double PageHeight = 1056;
    private const double PdfWidthPoints = 612;
    private const double PdfHeightPoints = 792;
    private const double RenderDpi = 192;

    public static FlowDocument CreatePrintableDocument(FlowDocument source, BrandingSettings branding, ImageSource? logo)
    {
        var document = (FlowDocument)XamlReader.Parse(XamlWriter.Save(source));
        document.PageWidth = PageWidth;
        document.PageHeight = PageHeight;
        document.PagePadding = new Thickness(72);
        document.ColumnWidth = double.PositiveInfinity;

        var organizationName = branding.OrganizationName?.Trim() ?? "";
        if (!string.IsNullOrWhiteSpace(organizationName))
        {
            var headerTable = new Table { CellSpacing = 0, Margin = new Thickness(0, 0, 0, 28) };
            headerTable.Columns.Add(new TableColumn { Width = new GridLength(2, GridUnitType.Star) });
            headerTable.Columns.Add(new TableColumn { Width = new GridLength(1, GridUnitType.Star) });
            var rowGroup = new TableRowGroup();
            var row = new TableRow();
            var brandCell = new TableCell { Padding = new Thickness(0) };
            if (logo is not null)
            {
                brandCell.Blocks.Add(new BlockUIContainer(new Image { Source = logo, Height = 42, MaxWidth = 180, Stretch = Stretch.Uniform, HorizontalAlignment = HorizontalAlignment.Left }) { Margin = new Thickness(0, 0, 0, 5) });
            }
            var brandName = new Paragraph(new Run(organizationName.ToUpperInvariant())) { FontSize = 13, FontWeight = FontWeights.Bold, Margin = new Thickness(0) };
            if (TryColor(branding.PrimaryColor, out var color)) brandName.Foreground = new SolidColorBrush(color);
            brandCell.Blocks.Add(brandName);
            if (!string.IsNullOrWhiteSpace(branding.Tagline)) brandCell.Blocks.Add(new Paragraph(new Run(branding.Tagline)) { FontSize = 8.5, Foreground = Brushes.DimGray, Margin = new Thickness(0, 3, 0, 0) });

            var contact = string.Join("\n", new[] { branding.AddressLine, branding.ContactPhone, branding.ContactEmail, branding.WebsiteUrl }.Where(value => !string.IsNullOrWhiteSpace(value)));
            var contactCell = new TableCell(new Paragraph(new Run(contact)) { FontSize = 8.5, TextAlignment = TextAlignment.Right, Foreground = Brushes.DarkSlateGray, LineHeight = 13, Margin = new Thickness(0) }) { Padding = new Thickness(12, 0, 0, 0) };
            row.Cells.Add(brandCell);
            row.Cells.Add(contactCell);
            rowGroup.Rows.Add(row);
            headerTable.RowGroups.Add(rowGroup);
            document.Blocks.InsertBefore(document.Blocks.FirstBlock, headerTable);
        }
        return document;
    }

    public static void Save(FlowDocument source, BrandingSettings branding, ImageSource? logo, string outputPath)
    {
        var document = CreatePrintableDocument(source, branding, logo);

        var paginator = ((IDocumentPaginatorSource)document).DocumentPaginator;
        paginator.PageSize = new Size(PageWidth, PageHeight);
        paginator.ComputePageCount();

        using var pdf = new PdfDocument();
        for (var pageIndex = 0; pageIndex < paginator.PageCount; pageIndex++)
        {
            var documentPage = paginator.GetPage(pageIndex);
            var bitmap = new RenderTargetBitmap(
                (int)Math.Ceiling(PageWidth * RenderDpi / 96),
                (int)Math.Ceiling(PageHeight * RenderDpi / 96),
                RenderDpi,
                RenderDpi,
                PixelFormats.Pbgra32);
            bitmap.Render(documentPage.Visual);

            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(bitmap));
            using var imageStream = new MemoryStream();
            encoder.Save(imageStream);
            imageStream.Position = 0;

            var page = pdf.AddPage();
            page.Width = XUnit.FromPoint(PdfWidthPoints);
            page.Height = XUnit.FromPoint(PdfHeightPoints);
            using var graphics = XGraphics.FromPdfPage(page);
            using var image = XImage.FromStream(imageStream);
            graphics.DrawImage(image, 0, 0, PdfWidthPoints, PdfHeightPoints);
        }

        pdf.Info.Creator = "OyamaPrint";
        pdf.Save(outputPath);
    }

    private static bool TryColor(string value, out Color color)
    {
        try { color = (Color)ColorConverter.ConvertFromString(value); return true; }
        catch { color = Color.FromRgb(18, 100, 163); return false; }
    }
}
