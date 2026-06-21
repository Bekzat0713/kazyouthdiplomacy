using System;
using System.Drawing;
using System.Windows.Forms;

namespace Gr8FoodSystem
{
    public class ManagerDashboard : Form
    {
        public ManagerDashboard() { InitializeComponent(); }
        private void InitializeComponent()
        {
            ThemeHelper.ApplyForm(this);
            this.Text = "Gr8Food — Manager Dashboard";
            this.Size = new Size(560, 470);
            this.Controls.Add(ThemeHelper.MakeHeader("Manager Dashboard", "Welcome, " + LoginForm.CurrentUser.FullName));
            int x=80, y=110, gap=66;
            var b1=ThemeHelper.MakeMenuButton("Customer Feedback", x, y);
            var b2=ThemeHelper.MakeMenuButton("E-Wallet Report",   x, y+gap);
            var b3=ThemeHelper.MakeMenuButton("My Profile",        x, y+gap*2);
            var bOut=ThemeHelper.MakeButton("Logout", 420, 400, 90, 30, ThemeHelper.Dark);
            b1.Click  +=(s,e)=>new FeedbackViewForm().ShowDialog();
            b2.Click  +=(s,e)=>new WalletReportForm().ShowDialog();
            b3.Click  +=(s,e)=>new ProfileForm().ShowDialog();
            bOut.Click+=(s,e)=>{ if(System.Windows.Forms.MessageBox.Show("Logout?","Confirm",MessageBoxButtons.YesNo)==DialogResult.Yes) this.Close(); };
            this.Controls.AddRange(new Control[]{b1,b2,b3,bOut});
        }
    }
}
