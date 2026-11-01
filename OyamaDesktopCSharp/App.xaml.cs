using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.IO;
namespace OyamaDesktop;
public partial class App : Application {
 protected override void OnStartup(StartupEventArgs e) {
  if(e.Args.Length==2 && e.Args[0]=="--capture") {

   var window=new MainWindow();window.Show();
   window.Dispatcher.InvokeAsync(()=>{
    var bitmap=new RenderTargetBitmap((int)window.ActualWidth,(int)window.ActualHeight,96,96,PixelFormats.Pbgra32);bitmap.Render(window);
    var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using(var stream=File.Create(e.Args[1]))encoder.Save(stream);Shutdown();
   },System.Windows.Threading.DispatcherPriority.ApplicationIdle);
  }
  else new MainWindow().Show();
  base.OnStartup(e);
 }
}
