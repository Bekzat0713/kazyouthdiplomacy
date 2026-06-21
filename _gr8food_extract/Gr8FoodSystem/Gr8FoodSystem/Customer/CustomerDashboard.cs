using System;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Models;

namespace Gr8FoodSystem
{
    public class CustomerDashboard : Form
    {
        private Label lblBalance;
        public CustomerDashboard() { InitializeComponent(); RefreshBalance(); }
        private void InitializeComponent()
        {
            ThemeHelper.ApplyForm(this);
            this.Text = "Gr8Food — Customer Dashboard";
            this.Size = new Size(560, 600);
            this.Controls.Add(ThemeHelper.MakeHeader("Customer Dashboard", "Welcome, " + LoginForm.CurrentUser.FullName));

            lblBalance = new Label { Text="E-Wallet Balance: RM 0.00", Font=ThemeHelper.FontHead,
                ForeColor=ThemeHelper.Primary, Location=new Point(80,100), Size=new Size(290,28), TextAlign=ContentAlignment.MiddleLeft };

            // Top Up button next to balance
            var bTopUp = ThemeHelper.MakeButton("+ Top Up", 380, 100, 100, 28, ThemeHelper.Success);
            bTopUp.Click += (s,e) => { var f=new WalletTopUpForm(); f.FormClosed+=(ss,ee)=>RefreshBalance(); f.ShowDialog(); };

            int x=80, y=146, gap=64;
            var b1=ThemeHelper.MakeMenuButton("Browse Menu & Order Food", x, y);
            var b2=ThemeHelper.MakeMenuButton("My Orders",                x, y+gap);
            var b3=ThemeHelper.MakeMenuButton("Send Feedback",            x, y+gap*2);
            var b4=ThemeHelper.MakeMenuButton("My Profile",               x, y+gap*3);
            var bOut=ThemeHelper.MakeButton("Logout", 420, 530, 90, 30, ThemeHelper.Dark);
            b1.Click  +=(s,e)=>{ var f=new MenuBrowseForm();    f.FormClosed+=(ss,ee)=>RefreshBalance(); f.ShowDialog(); };
            b2.Click  +=(s,e)=>{ var f=new OrderHistoryForm();  f.FormClosed+=(ss,ee)=>RefreshBalance(); f.ShowDialog(); };
            b3.Click  +=(s,e)=>new FeedbackSubmitForm().ShowDialog();
            b4.Click  +=(s,e)=>new ProfileForm().ShowDialog();
            bOut.Click+=(s,e)=>{ if(System.Windows.Forms.MessageBox.Show("Logout?","Confirm",MessageBoxButtons.YesNo)==DialogResult.Yes) this.Close(); };
            this.Controls.AddRange(new Control[]{lblBalance,bTopUp,b1,b2,b3,b4,bOut});
        }
        public void RefreshBalance()
        {
            var row=DBHelper.ExecuteQuery("SELECT WalletBalance FROM Customers WHERE CustomerID=@ID",
                new SqlParameter[]{new SqlParameter("@ID",LoginForm.CurrentUser.UserID)});
            if(row.Rows.Count>0){ decimal bal=Convert.ToDecimal(row.Rows[0]["WalletBalance"]);
                LoginForm.CurrentUser.WalletBalance=bal;
                lblBalance.Text=$"E-Wallet Balance: RM {bal:F2}"; }
        }
    }
}
