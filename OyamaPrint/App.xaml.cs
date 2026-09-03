using System.Windows;
using OyamaPrint.Services;

namespace OyamaPrint;

public partial class App : Application
{
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        var api = new LettersApiClient();
        var session = await api.TryRestoreSessionAsync();
        if (session is null)
        {
            var login = new LoginWindow(api);
            if (login.ShowDialog() != true || login.Session is null)
            {
                Shutdown();
                return;
            }
            session = login.Session;
        }

        var main = new MainWindow(api, session);
        MainWindow = main;
        ShutdownMode = ShutdownMode.OnMainWindowClose;
        main.Show();
    }
}
