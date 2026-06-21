using System;
using System.Drawing;
using System.Windows.Forms;

namespace Gr8FoodSystem
{
    public class ChefDashboard : Form
    {
        public ChefDashboard() { InitializeComponent(); }
        private void InitializeComponent()
        {
            ThemeHelper.ApplyForm(this);
            this.Text = "Gr8Food — Chef Dashboard";
            this.Size = new Size(560, 470);
            this.Controls.Add(ThemeHelper.MakeHeader("Chef Dashboard", "Welcome, " + LoginForm.CurrentUser.FullName));
            int x=80, y=110, gap=66;
            var b1=ThemeHelper.MakeMenuButton("Menu Management",  x, y);
            var b2=ThemeHelper.MakeMenuButton("Order Management", x, y+gap);
            var b3=ThemeHelper.MakeMenuButton("My Profile",       x, y+gap*2);
            var bOut=ThemeHelper.MakeButton("Logout", 420, 400, 90, 30, ThemeHelper.Dark);
            b1.Click  +=(s,e)=>new MenuManagementForm().ShowDialog();
            b2.Click  +=(s,e)=>new OrderManagementForm().ShowDialog();
            b3.Click  +=(s,e)=>new ProfileForm().ShowDialog();
            bOut.Click+=(s,e)=>{ if(System.Windows.Forms.MessageBox.Show("Logout?","Confirm",MessageBoxButtons.YesNo)==DialogResult.Yes) this.Close(); };
            this.Controls.AddRange(new Control[]{b1,b2,b3,bOut});
        }
    }
}
