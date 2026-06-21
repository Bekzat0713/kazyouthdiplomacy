using System;
using System.Drawing;
using System.Windows.Forms;

namespace Gr8FoodSystem
{
    // The main menu window for the Admin. It just has buttons.
    public class AdminDashboard : Form
    {
        public AdminDashboard()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            ThemeHelper.ApplyForm(this);
            this.Text = "Gr8Food — Admin Dashboard";
            this.Size = new Size(560, 470);

            // Title bar at the top
            Panel header = ThemeHelper.MakeHeader("Admin Dashboard", "Welcome, " + LoginForm.CurrentUser.FullName);
            this.Controls.Add(header);

            // Create the menu buttons
            Button btnUsers = ThemeHelper.MakeMenuButton("Manage Users", 80, 110);
            Button btnSales = ThemeHelper.MakeMenuButton("Sales Report", 80, 176);
            Button btnProfile = ThemeHelper.MakeMenuButton("My Profile", 80, 242);
            Button btnLogout = ThemeHelper.MakeButton("Logout", 420, 400, 90, 30, ThemeHelper.Dark);

            // Tell each button which method to run when it is clicked
            btnUsers.Click += BtnUsers_Click;
            btnSales.Click += BtnSales_Click;
            btnProfile.Click += BtnProfile_Click;
            btnLogout.Click += BtnLogout_Click;

            // Put the buttons on the form
            this.Controls.Add(btnUsers);
            this.Controls.Add(btnSales);
            this.Controls.Add(btnProfile);
            this.Controls.Add(btnLogout);
        }

        // Open the "Manage Users" window
        private void BtnUsers_Click(object sender, EventArgs e)
        {
            UserManagementForm form = new UserManagementForm();
            form.ShowDialog();
        }

        // Open the "Sales Report" window
        private void BtnSales_Click(object sender, EventArgs e)
        {
            SalesReportForm form = new SalesReportForm();
            form.ShowDialog();
        }

        // Open the "My Profile" window
        private void BtnProfile_Click(object sender, EventArgs e)
        {
            ProfileForm form = new ProfileForm();
            form.ShowDialog();
        }

        // Ask "Logout?" and close this window if the user says Yes
        private void BtnLogout_Click(object sender, EventArgs e)
        {
            DialogResult answer = MessageBox.Show("Logout?", "Confirm", MessageBoxButtons.YesNo);
            if (answer == DialogResult.Yes)
            {
                this.Close();
            }
        }
    }
}
