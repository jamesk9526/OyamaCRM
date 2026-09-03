using System.Windows;
using OyamaPrint.Models;
using OyamaPrint.Services;

namespace OyamaPrint;

public partial class LoginWindow : Window
{
    private readonly LettersApiClient _api;
    private string? _mfaTicket;

    public LoginResult? Session { get; private set; }

    public LoginWindow(LettersApiClient api)
    {
        _api = api;
        InitializeComponent();
        Loaded += (_, _) => EmailBox.Focus();
    }

    private async void SignInButton_Click(object sender, RoutedEventArgs e)
    {
        SignInButton.IsEnabled = false;
        SignInButton.Content = _mfaTicket is null ? "Signing in…" : "Verifying…";
        MessageText.Text = "";
        try
        {
            _api.Configure(ApiUrlBox.Text);
            var result = _mfaTicket is null
                ? await _api.LoginAsync(EmailBox.Text, PasswordInput.Password)
                : await _api.VerifyMfaAsync(_mfaTicket, CodeBox.Text);
            if (result.MfaRequired)
            {
                _mfaTicket = result.MfaTicket;
                MfaPanel.Visibility = Visibility.Visible;
                MessageText.Foreground = System.Windows.Media.Brushes.DarkSlateBlue;
                MessageText.Text = $"Enter the verification code sent to {result.DestinationHint}.";
                CodeBox.Focus();
                return;
            }

            Session = result;
            if (RememberCheckBox.IsChecked == true) _api.RememberSession();
            else LettersApiClient.ForgetSession();
            DialogResult = true;
        }
        catch (Exception error)
        {
            MessageText.Foreground = System.Windows.Media.Brushes.Firebrick;
            MessageText.Text = FriendlyMessage(error.Message);
        }
        finally
        {
            SignInButton.IsEnabled = true;
            SignInButton.Content = _mfaTicket is null ? "Sign in" : "Verify and continue";
        }
    }

    private static string FriendlyMessage(string message) => message.Contains("INVALID_CREDENTIALS", StringComparison.OrdinalIgnoreCase)
        ? "The email or password is incorrect. Please try again."
        : message;
}
