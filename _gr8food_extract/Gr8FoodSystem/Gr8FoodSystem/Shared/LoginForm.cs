using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Models;

namespace Gr8FoodSystem
{
    // This is the first window the user sees. It asks for Login ID and Password.
    public class LoginForm : Form
    {
        // Here we remember which user is logged in. Other windows can read this.
        public static User CurrentUser { get; private set; }

        // Controls on the screen
        private TextBox txtLoginID;
        private TextBox txtPassword;
        private Button btnLogin;
        private Label lblError;

        public LoginForm()
        {
            InitializeComponent();
        }

        // This method builds all the boxes, labels and the button on the form.
        private void InitializeComponent()
        {
            ThemeHelper.ApplyForm(this);
            this.Text = "Gr8Food — Login";
            this.Size = new Size(420, 430);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;

            // Dark panel at the top with the title
            Panel pnlHeader = new Panel();
            pnlHeader.BackColor = ThemeHelper.Dark;
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.Height = 100;

            Label lblTitle = new Label();
            lblTitle.Text = "Gr8Food";
            lblTitle.Font = new Font("Segoe UI", 22, FontStyle.Bold);
            lblTitle.ForeColor = ThemeHelper.White;
            lblTitle.Location = new Point(0, 12);
            lblTitle.Size = new Size(420, 46);
            lblTitle.TextAlign = ContentAlignment.MiddleCenter;
            pnlHeader.Controls.Add(lblTitle);

            Label lblSubtitle = new Label();
            lblSubtitle.Text = "Restaurant Management System";
            lblSubtitle.Font = ThemeHelper.FontSmall;
            lblSubtitle.ForeColor = Color.FromArgb(149, 165, 166);
            lblSubtitle.Location = new Point(0, 60);
            lblSubtitle.Size = new Size(420, 22);
            lblSubtitle.TextAlign = ContentAlignment.MiddleCenter;
            pnlHeader.Controls.Add(lblSubtitle);

            // "Login ID" label and text box
            Label lblLoginID = new Label();
            lblLoginID.Text = "Login ID";
            lblLoginID.Font = ThemeHelper.FontLabel;
            lblLoginID.ForeColor = ThemeHelper.TextDark;
            lblLoginID.Location = new Point(50, 126);
            lblLoginID.Size = new Size(300, 20);

            txtLoginID = new TextBox();
            txtLoginID.Font = ThemeHelper.FontBody;
            txtLoginID.Location = new Point(50, 148);
            txtLoginID.Size = new Size(300, 28);

            // "Password" label and text box (stars instead of letters)
            Label lblPassword = new Label();
            lblPassword.Text = "Password";
            lblPassword.Font = ThemeHelper.FontLabel;
            lblPassword.ForeColor = ThemeHelper.TextDark;
            lblPassword.Location = new Point(50, 190);
            lblPassword.Size = new Size(300, 20);

            txtPassword = new TextBox();
            txtPassword.Font = ThemeHelper.FontBody;
            txtPassword.Location = new Point(50, 212);
            txtPassword.Size = new Size(300, 28);
            txtPassword.PasswordChar = '*';

            // Red label that shows error messages
            lblError = new Label();
            lblError.Text = "";
            lblError.Font = ThemeHelper.FontSmall;
            lblError.ForeColor = ThemeHelper.Danger;
            lblError.Location = new Point(50, 248);
            lblError.Size = new Size(300, 20);
            lblError.TextAlign = ContentAlignment.MiddleCenter;

            // Login button
            btnLogin = ThemeHelper.MakeButton("LOGIN", 50, 276, 300, 46);
            btnLogin.Font = ThemeHelper.FontHead;
            btnLogin.Click += BtnLogin_Click;
            this.AcceptButton = btnLogin;

            // Small copyright label at the bottom
            Label lblFooter = new Label();
            lblFooter.Text = "Gr8Food © 2026";
            lblFooter.Font = new Font("Segoe UI", 8);
            lblFooter.ForeColor = ThemeHelper.TextGray;
            lblFooter.Location = new Point(0, 338);
            lblFooter.Size = new Size(400, 20);
            lblFooter.TextAlign = ContentAlignment.MiddleCenter;

            // Add every control to the form
            this.Controls.Add(pnlHeader);
            this.Controls.Add(lblLoginID);
            this.Controls.Add(txtLoginID);
            this.Controls.Add(lblPassword);
            this.Controls.Add(txtPassword);
            this.Controls.Add(lblError);
            this.Controls.Add(btnLogin);
            this.Controls.Add(lblFooter);
        }

        // This runs when the user clicks the LOGIN button.
        private void BtnLogin_Click(object sender, EventArgs e)
        {
            lblError.Text = "";

            string loginID = txtLoginID.Text.Trim();
            string password = txtPassword.Text;

            // Step 1: make sure both boxes are filled
            if (string.IsNullOrWhiteSpace(loginID) || string.IsNullOrWhiteSpace(password))
            {
                lblError.Text = "Please enter Login ID and Password.";
                return;
            }

            try
            {
                // Step 2: look for this user in the database
                string query = @"SELECT u.UserID, u.LoginID, u.Role, u.FullName, u.Email, u.PhoneNumber,
                                        c.WalletBalance, c.Address
                                 FROM Users u
                                 LEFT JOIN Customers c ON u.UserID = c.CustomerID
                                 WHERE u.LoginID = @L AND u.Password = @P AND u.IsActive = 1";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@L", loginID),
                    new SqlParameter("@P", password)
                };

                DataTable table = DBHelper.ExecuteQuery(query, parameters);

                // Step 3: if nothing was found, the login is wrong
                if (table.Rows.Count == 0)
                {
                    lblError.Text = "Invalid Login ID or Password.";
                    txtPassword.Clear();
                    return;
                }

                // Step 4: read the data from the first row
                DataRow row = table.Rows[0];
                string role = row["Role"].ToString();
                int userID = Convert.ToInt32(row["UserID"]);
                string lid = row["LoginID"].ToString();
                string name = row["FullName"].ToString();
                string email = row["Email"].ToString();
                string phone = row["PhoneNumber"].ToString();

                // Step 5: create the user object (one class is used for every role)
                CurrentUser = new User(userID, lid, role, name, email, phone);

                // Customers also have a wallet balance and an address
                if (role == "Customer")
                {
                    if (row["WalletBalance"] != DBNull.Value)
                    {
                        CurrentUser.WalletBalance = Convert.ToDecimal(row["WalletBalance"]);
                    }
                    if (row["Address"] != DBNull.Value)
                    {
                        CurrentUser.Address = row["Address"].ToString();
                    }
                }

                // Step 6: open the correct dashboard for this role
                if (role == "Admin")
                {
                    OpenDashboard(new AdminDashboard());
                }
                else if (role == "Manager")
                {
                    OpenDashboard(new ManagerDashboard());
                }
                else if (role == "Chef")
                {
                    OpenDashboard(new ChefDashboard());
                }
                else if (role == "Customer")
                {
                    OpenDashboard(new CustomerDashboard());
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Database error:\n" + ex.Message, "Error",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Hide the login window, show the dashboard, and when it closes show login again.
        private void OpenDashboard(Form dashboard)
        {
            this.Hide();
            dashboard.ShowDialog();   // wait here until the dashboard window is closed

            this.Show();
            txtLoginID.Clear();
            txtPassword.Clear();
            txtLoginID.Focus();
        }
    }
}
