using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Markup;

namespace OyamaPrint;

public sealed class PrintPreviewWindow : Window
{
    public PrintPreviewWindow(FlowDocument source)
    {
        Title = "OyamaPrint - Print preview";
        Width = 1000;
        Height = 820;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        var cloned = (FlowDocument)XamlReader.Parse(XamlWriter.Save(source));
        cloned.PageWidth = 816;
        cloned.PageHeight = 1056;
        cloned.PagePadding = new Thickness(72);
        Content = new DocumentViewer { Document = cloned, Background = System.Windows.Media.Brushes.Gainsboro };
    }
}
