using System.Data;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;
using OyamaDesktop.Models;
using OyamaDesktop.Services;
namespace OyamaDesktop;
public partial class MainWindow : Window {
 CrmClient? client; string ticket=""; int page=1; bool busy; DataTable table=new();
 WorkspaceModule? Selected => Modules.SelectedItem as WorkspaceModule;
 public MainWindow() { InitializeComponent(); Modules.ItemsSource=SuiteModules.All; Modules.SelectedIndex=0; Closed+=(_,_)=>client?.Dispose(); }
 async Task Run(Func<Task> action) { if(busy)return; busy=true; IsEnabled=false; Status.Text="Working…"; try {await action();}catch(Exception ex){Status.Text=ex.Message;}finally{busy=false;IsEnabled=true;} }
 async void Connect(object sender,RoutedEventArgs e) => await Run(async()=>{ client?.Dispose(); client=new(new Uri(Site.Text.Trim())); var data=await client.SignInAsync(Email.Text.Trim(),Password.Password); Password.Clear(); if(data.TryGetProperty("mfaRequired",out var required)&&required.GetBoolean()){ticket=data.GetProperty("mfaTicket").GetString()??"";MfaPanel.Visibility=Visibility.Visible;Status.Text="Enter the verification code sent to your email.";}else await Connected(); });
 async void Verify(object sender,RoutedEventArgs e)=>await Run(async()=>{if(client is null) return;await client.VerifyAsync(ticket,Code.Text.Trim());Code.Clear();await Connected();});
 async Task Connected(){LoginPanel.Visibility=Visibility.Collapsed;MfaPanel.Visibility=Visibility.Collapsed;ticket="";await Load();}
 async Task Load(){if(Selected?.ApiPath is not string endpoint){Status.Text="Local files · choose a text, CSV, JSON, or Markdown file. Files are never uploaded.";return;} if(client is null || LoginPanel.Visibility==Visibility.Visible){Status.Text="Sign in before loading CRM records.";return;} var json=await client.SendAsync(endpoint+"?page="+page+"&pageSize=50&limit=50&search="+Uri.EscapeDataString(Search.Text));var rows=json.ValueKind==JsonValueKind.Array?json:json.GetProperty("items");table=new();foreach(var row in rows.EnumerateArray())foreach(var field in row.EnumerateObject())if(!table.Columns.Contains(field.Name)&&field.Value.ValueKind is not (JsonValueKind.Array or JsonValueKind.Object))table.Columns.Add(field.Name);foreach(var row in rows.EnumerateArray()){var record=table.NewRow();foreach(DataColumn col in table.Columns)if(row.TryGetProperty(col.ColumnName,out var value))record[col]=value.ToString();table.Rows.Add(record);} Records.ItemsSource=table.DefaultView;PageLabel.Text=$"Page {page} · {table.Rows.Count} rows";Status.Text="Connected · showing this page only. Server permissions apply.";}
 async void ModuleChanged(object sender,SelectionChangedEventArgs e){if(Records is null)return;page=1;table=new();Records.ItemsSource=null;PageTitle.Text=Selected?.Title??"Workspace";Preview.Visibility=Selected?.Id=="files"?Visibility.Visible:Visibility.Collapsed;Records.Visibility=Selected?.Id=="files"?Visibility.Collapsed:Visibility.Visible;await Run(Load);}
 async void Refresh(object sender,RoutedEventArgs e){page=1;await Run(Load);}
 async void Previous(object sender,RoutedEventArgs e){if(page>1){page--;await Run(Load);}}
 async void Next(object sender,RoutedEventArgs e){if(table.Rows.Count==50){page++;await Run(Load);}}
 async void OpenFile(object sender,RoutedEventArgs e){var dialog=new OpenFileDialog{Filter="Text files|*.txt;*.csv;*.json;*.md;*.log"};if(dialog.ShowDialog()!=true)return;await Run(async()=>{var text=await LocalWorkspace.ReadPreviewAsync(dialog.FileName);Modules.SelectedItem=SuiteModules.All.First(m=>m.Id=="files");Preview.Text=text;Status.Text=$"Local preview · {Path.GetFileName(dialog.FileName)} · never uploaded";});}
 async void Export(object sender,RoutedEventArgs e){if(table.Rows.Count==0){Status.Text="Load CRM rows before exporting.";return;}var dialog=new SaveFileDialog{Filter="CSV|*.csv",FileName="oyama-records.csv"};if(dialog.ShowDialog()!=true)return;await Run(async()=>{static string Cell(string value){if(value.Length>0&&"=+-@".Contains(value[0]))value="'"+value;return "\""+value.Replace("\"","\"\"")+"\"";}var lines=new List<string>{string.Join(",",table.Columns.Cast<DataColumn>().Select(c=>Cell(c.ColumnName)))};lines.AddRange(table.Rows.Cast<DataRow>().Select(row=>string.Join(",",row.ItemArray.Select(v=>Cell(v?.ToString()??"")))));await File.WriteAllLinesAsync(dialog.FileName,lines);Status.Text="Visible page exported locally.";});}
 void GenerateColumn(object? sender, DataGridAutoGeneratingColumnEventArgs e) {
  if(e.PropertyName.EndsWith("Id",StringComparison.OrdinalIgnoreCase) || e.PropertyName=="id") { e.Cancel=true;return; }
  e.Column.Header=System.Text.RegularExpressions.Regex.Replace(e.PropertyName,"([a-z])([A-Z])","$1 $2");
  e.Column.MinWidth=120;
 }
 void RecordSelected(object sender,SelectionChangedEventArgs e) { if(Records.SelectedItem is DataRowView) Status.Text="Record selected · use Record details to inspect all returned fields."; }
 void ShowDetails(object sender,RoutedEventArgs e) {
  if(Records.SelectedItem is not DataRowView row){Status.Text="Select a record first.";return;}
  var panel=new StackPanel{Margin=new Thickness(24)};
  foreach(DataColumn column in row.DataView.Table!.Columns) {panel.Children.Add(new TextBlock{Text=column.ColumnName,FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,10,0,3)});panel.Children.Add(new TextBox{Text=row[column.ColumnName]?.ToString()??"",IsReadOnly=true,TextWrapping=TextWrapping.Wrap});}
  new Window{Owner=this,Title="Record details · read only",Width=560,Height=640,WindowStartupLocation=WindowStartupLocation.CenterOwner,Content=new ScrollViewer{Content=panel},Background=System.Windows.Media.Brushes.White}.ShowDialog();
 }
 async void SignOut(object sender,RoutedEventArgs e)=>await Run(async()=>{try{if(client is not null)await client.SendAsync("auth/logout",new{});}finally{client?.Dispose();client=null;Records.ItemsSource=null;table=new();LoginPanel.Visibility=Visibility.Visible;MfaPanel.Visibility=Visibility.Collapsed;ticket="";Password.Clear();Code.Clear();Status.Text="Signed out. Local session cleared.";}});
}
