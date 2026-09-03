using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace OyamaPrint.Services;

/// <summary>Small, safe HTML bridge for the print-safe subset stored by OyamaCRM letters.</summary>
public static class HtmlDocumentCodec
{
    private static readonly Regex TokenPattern = new("(<[^>]+>)|([^<]+)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static void LoadHtml(FlowDocument document, string? html)
    {
        document.Blocks.Clear();
        var paragraph = NewParagraph();
        var bold = false;
        var italic = false;
        var underline = false;
        var strike = false;
        double? fontSize = null;
        string? fontFamily = null;
        Brush? foreground = null;
        Brush? background = null;

        foreach (Match match in TokenPattern.Matches(html ?? ""))
        {
            var value = match.Value;
            if (!value.StartsWith('<'))
            {
                var decoded = WebUtility.HtmlDecode(value).Replace("\r", "");
                if (decoded.Length > 0) paragraph.Inlines.Add(CreateRun(decoded, bold, italic, underline, strike, fontSize, fontFamily, foreground, background));
                continue;
            }

            var tag = value.Trim('<', '>', ' ', '/').Split(' ', StringSplitOptions.RemoveEmptyEntries)[0].ToLowerInvariant();
            var closing = value.StartsWith("</", StringComparison.Ordinal);
            if (tag is "p" or "div" or "h1" or "h2" or "h3")
            {
                if (closing)
                {
                    document.Blocks.Add(paragraph);
                    paragraph = NewParagraph();
                }
                else if (tag.StartsWith('h'))
                {
                    paragraph.FontSize = tag == "h1" ? 18 : tag == "h2" ? 15 : 13;
                    paragraph.FontWeight = System.Windows.FontWeights.Bold;
                }
                if (!closing)
                {
                    if (value.Contains("text-align:center", StringComparison.OrdinalIgnoreCase)) paragraph.TextAlignment = TextAlignment.Center;
                    else if (value.Contains("text-align:right", StringComparison.OrdinalIgnoreCase)) paragraph.TextAlignment = TextAlignment.Right;
                    else if (value.Contains("text-align:justify", StringComparison.OrdinalIgnoreCase)) paragraph.TextAlignment = TextAlignment.Justify;
                    if (value.Contains("page-break-before:always", StringComparison.OrdinalIgnoreCase)) paragraph.BreakPageBefore = true;
                    var leftMargin = CssValue(value, "margin-left");
                    if (leftMargin is not null && double.TryParse(leftMargin.TrimEnd('p', 'x'), out var left)) paragraph.Margin = new Thickness(left, 0, 0, 10);
                }
            }
            else if (tag == "br") paragraph.Inlines.Add(new LineBreak());
            else if (tag is "strong" or "b") bold = !closing;
            else if (tag is "em" or "i") italic = !closing;
            else if (tag == "u") underline = !closing;
            else if (tag == "s") strike = !closing;
            else if (tag == "span")
            {
                if (closing)
                {
                    fontSize = null; fontFamily = null; foreground = null; background = null;
                }
                else
                {
                    var size = CssValue(value, "font-size");
                    if (size is not null && double.TryParse(size.TrimEnd('p', 'x'), out var parsedSize)) fontSize = parsedSize;
                    fontFamily = CssValue(value, "font-family")?.Trim('\'', '"');
                    foreground = ParseBrush(CssValue(value, "color"));
                    background = ParseBrush(CssValue(value, "background-color"));
                }
            }
            else if (tag == "li" && !closing)
            {
                paragraph.Inlines.Add(CreateRun("• ", false, false, false, false, null, null, null, null));
            }
        }

        if (paragraph.Inlines.Count > 0 || document.Blocks.Count == 0) document.Blocks.Add(paragraph);
    }

    public static string ToHtml(FlowDocument document)
    {
        var builder = new StringBuilder();
        foreach (var block in document.Blocks) AppendBlock(builder, block);
        return builder.Length == 0 ? "<p></p>" : builder.ToString();
    }

    private static void AppendBlock(StringBuilder builder, Block block)
    {
        if (block is Paragraph paragraph)
        {
            var tag = paragraph.FontSize >= 17 ? "h1" : paragraph.FontSize >= 14 ? "h2" : "p";
            var styles = new List<string>();
            if (paragraph.TextAlignment != TextAlignment.Left) styles.Add($"text-align:{paragraph.TextAlignment.ToString().ToLowerInvariant()}");
            if (paragraph.Margin.Left > 0) styles.Add($"margin-left:{paragraph.Margin.Left:0.#}px");
            if (paragraph.BreakPageBefore) styles.Add("page-break-before:always");
            builder.Append('<').Append(tag);
            if (styles.Count > 0) builder.Append(" style=\"").Append(string.Join(';', styles)).Append("\"");
            builder.Append('>');
            foreach (var inline in paragraph.Inlines) AppendInline(builder, inline);
            builder.Append("</").Append(tag).Append('>');
            return;
        }
        if (block is List list)
        {
            var tag = list.MarkerStyle is TextMarkerStyle.Decimal or TextMarkerStyle.LowerLatin or TextMarkerStyle.UpperLatin or TextMarkerStyle.LowerRoman or TextMarkerStyle.UpperRoman ? "ol" : "ul";
            builder.Append('<').Append(tag).Append('>');
            foreach (var item in list.ListItems)
            {
                builder.Append("<li>");
                foreach (var child in item.Blocks) AppendBlock(builder, child);
                builder.Append("</li>");
            }
            builder.Append("</").Append(tag).Append('>');
        }
    }

    private static Paragraph NewParagraph() => new() { Margin = new Thickness(0, 0, 0, 10), LineHeight = 18 };

    private static Run CreateRun(string text, bool bold, bool italic, bool underline, bool strike, double? fontSize, string? fontFamily, Brush? foreground, Brush? background)
    {
        var run = new Run(text);
        if (bold) run.FontWeight = System.Windows.FontWeights.Bold;
        if (italic) run.FontStyle = System.Windows.FontStyles.Italic;
        if (underline) run.TextDecorations = TextDecorations.Underline;
        if (strike) run.TextDecorations = TextDecorations.Strikethrough;
        if (fontSize is not null) run.FontSize = fontSize.Value;
        if (!string.IsNullOrWhiteSpace(fontFamily)) run.FontFamily = new FontFamily(fontFamily);
        if (foreground is not null) run.Foreground = foreground;
        if (background is not null) run.Background = background;
        return run;
    }

    private static string? CssValue(string tag, string property)
    {
        var match = Regex.Match(tag, $@"(?:^|[;\""'])\s*{Regex.Escape(property)}\s*:\s*([^;\""']+)", RegexOptions.IgnoreCase);
        return match.Success ? WebUtility.HtmlDecode(match.Groups[1].Value.Trim()) : null;
    }

    private static Brush? ParseBrush(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try { return new SolidColorBrush((Color)ColorConverter.ConvertFromString(value)); }
        catch { return null; }
    }

    private static void AppendInline(StringBuilder builder, Inline inline)
    {
        if (inline is LineBreak) { builder.Append("<br />"); return; }
        if (inline is Run run)
        {
            var bold = run.FontWeight == System.Windows.FontWeights.Bold;
            var italic = run.FontStyle == System.Windows.FontStyles.Italic;
            var underline = run.TextDecorations?.Contains(TextDecorations.Underline[0]) == true;
            var strike = run.TextDecorations?.Contains(TextDecorations.Strikethrough[0]) == true;
            var styles = new List<string>();
            if (run.FontSize > 0) styles.Add($"font-size:{run.FontSize:0.#}px");
            if (run.FontFamily is not null) styles.Add($"font-family:'{WebUtility.HtmlEncode(run.FontFamily.Source)}'");
            if (run.Foreground is System.Windows.Media.SolidColorBrush foreground) styles.Add($"color:{foreground.Color}");
            if (run.Background is System.Windows.Media.SolidColorBrush background) styles.Add($"background-color:{background.Color}");
            if (styles.Count > 0) builder.Append("<span style=\"").Append(string.Join(';', styles)).Append("\">");
            if (bold) builder.Append("<strong>");
            if (italic) builder.Append("<em>");
            if (underline) builder.Append("<u>");
            if (strike) builder.Append("<s>");
            builder.Append(WebUtility.HtmlEncode(run.Text));
            if (strike) builder.Append("</s>");
            if (underline) builder.Append("</u>");
            if (italic) builder.Append("</em>");
            if (bold) builder.Append("</strong>");
            if (styles.Count > 0) builder.Append("</span>");
        }
        else if (inline is Span span)
        {
            var bold = span.FontWeight == System.Windows.FontWeights.Bold;
            var italic = span.FontStyle == System.Windows.FontStyles.Italic;
            var underline = span.TextDecorations?.Contains(TextDecorations.Underline[0]) == true;
            if (bold) builder.Append("<strong>");
            if (italic) builder.Append("<em>");
            if (underline) builder.Append("<u>");
            foreach (Inline child in span.Inlines) AppendInline(builder, child);
            if (underline) builder.Append("</u>");
            if (italic) builder.Append("</em>");
            if (bold) builder.Append("</strong>");
        }
    }
}
