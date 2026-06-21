using System;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Helpers;
using Gr8FoodSystem.Models;

namespace Gr8FoodSystem
{
    public class ProfileForm : Form
    {
        private TextBox txtFullName, txtEmail, txtPhone, txtAddress;
        private TextBox txtOldPassword, txtNewPassword, txtConfirmPassword;
        private Button btnSaveProfile, btnChangePassword;
        private Label lblStatus, lblBalance;
        private Panel pnlAddress;

        public ProfileForm()
        {
            InitializeComponent();
            LoadCurrentData();
        }

        private void InitializeComponent()
        {
            User u = LoginForm.CurrentUser;

            this.Text = "My Profile";
            this.Size = new Size(520, 560);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(70, 70, 70), Dock = DockStyle.Top, Height = 60 };
            pnlTop.Controls.Add(new Label
            {
                Text = $"{u.FullName}  —  {u.Role}",
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            Label MkL(string t, int y) => new Label
            {
                Text = t, Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(20, y), Size = new Size(130, 24),
                ForeColor = Color.FromArgb(50, 50, 50)
            };
            TextBox MkT(int y) => new TextBox
            {
                Font = new Font("Segoe UI", 10),
                Location = new Point(160, y), Size = new Size(320, 26)
            };

            // Profile fields
            int fy = 78, gap = 38;
            txtFullName = MkT(fy);
            txtEmail    = MkT(fy + gap);
            txtPhone    = MkT(fy + gap * 2);

            // Address — only shown for Customer
            pnlAddress = new Panel
            {
                Location = new Point(0, fy + gap * 3),
                Size = new Size(480, 34),
                Visible = u.Role == "Customer"
            };
            txtAddress = MkT(0);
            txtAddress.Width = 320;
            pnlAddress.Controls.Add(MkL("Address:", 0));
            pnlAddress.Controls.Add(txtAddress);

            // Wallet balance (read-only, Customer only)
            lblBalance = new Label
            {
                Text = "",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(20, fy + gap * 4 + 4),
                Size = new Size(460, 24),
                ForeColor = Color.FromArgb(0, 140, 60),
                Visible = u.Role == "Customer"
            };

            btnSaveProfile = new Button
            {
                Text = "Save Profile Changes",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(20, 250), Size = new Size(460, 40),
                BackColor = Color.FromArgb(70, 70, 70), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnSaveProfile.FlatAppearance.BorderSize = 0;
            btnSaveProfile.Click += BtnSaveProfile_Click;

            // Password section
            Label lblPwdTitle = new Label
            {
                Text = "Change Password",
                Font = new Font("Segoe UI", 10, FontStyle.Bold | FontStyle.Underline),
                Location = new Point(20, 304), Size = new Size(460, 24),
                ForeColor = Color.FromArgb(50, 50, 50)
            };

            txtOldPassword     = MkT(332); txtOldPassword.PasswordChar = '*';
            txtNewPassword     = MkT(370); txtNewPassword.PasswordChar = '*';
            txtConfirmPassword = MkT(408); txtConfirmPassword.PasswordChar = '*';

            btnChangePassword = new Button
            {
                Text = "Update Password",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(20, 446), Size = new Size(460, 38),
                BackColor = Color.FromArgb(180, 30, 30), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnChangePassword.FlatAppearance.BorderSize = 0;
            btnChangePassword.Click += BtnChangePassword_Click;

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(20, 492), Size = new Size(460, 22),
                ForeColor = Color.DarkGreen, TextAlign = ContentAlignment.MiddleCenter
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop,
                MkL("Full Name:", fy), txtFullName,
                MkL("Email:", fy + gap), txtEmail,
                MkL("Phone:", fy + gap * 2), txtPhone,
                pnlAddress, lblBalance,
                btnSaveProfile,
                lblPwdTitle,
                MkL("Current Password:", 332), txtOldPassword,
                MkL("New Password:", 370), txtNewPassword,
                MkL("Confirm Password:", 408), txtConfirmPassword,
                btnChangePassword, lblStatus
            });
        }

        private void LoadCurrentData()
        {
            User u = LoginForm.CurrentUser;
            txtFullName.Text = u.FullName;
            txtEmail.Text    = u.Email;
            txtPhone.Text    = u.PhoneNumber;

            if (u.Role == "Customer")
            {
                txtAddress.Text = u.Address;
                lblBalance.Text = $"Current Wallet Balance: RM {u.WalletBalance:F2}";
            }
        }

        private void BtnSaveProfile_Click(object sender, EventArgs e)
        {
            if (!ValidationHelper.IsValidEmail(txtEmail.Text.Trim()))
            { SetStatus("Enter a valid email address.", Color.Red); return; }

            if (!ValidationHelper.IsValidPhone(txtPhone.Text.Trim()))
            { SetStatus("Phone: 10-11 digits only.", Color.Red); return; }

            if (ValidationHelper.IsEmpty(txtFullName.Text))
            { SetStatus("Full name is required.", Color.Red); return; }

            string q = @"UPDATE Users
                         SET FullName=@F, Email=@E, PhoneNumber=@Ph
                         WHERE UserID=@ID";
            SqlParameter[] p =
            {
                new SqlParameter("@F",  txtFullName.Text.Trim()),
                new SqlParameter("@E",  txtEmail.Text.Trim()),
                new SqlParameter("@Ph", txtPhone.Text.Trim()),
                new SqlParameter("@ID", LoginForm.CurrentUser.UserID)
            };
            DBHelper.ExecuteNonQuery(q, p);

            if (LoginForm.CurrentUser.Role == "Customer" && pnlAddress.Visible)
            {
                DBHelper.ExecuteNonQuery(
                    "UPDATE Customers SET Address=@A WHERE CustomerID=@ID",
                    new SqlParameter[] {
                        new SqlParameter("@A",  txtAddress.Text.Trim()),
                        new SqlParameter("@ID", LoginForm.CurrentUser.UserID) });
                LoginForm.CurrentUser.Address = txtAddress.Text.Trim();
            }

            // Update in-memory user
            LoginForm.CurrentUser.FullName    = txtFullName.Text.Trim();
            LoginForm.CurrentUser.Email       = txtEmail.Text.Trim();
            LoginForm.CurrentUser.PhoneNumber = txtPhone.Text.Trim();

            SetStatus("Profile updated successfully.", Color.DarkGreen);
        }

        private void BtnChangePassword_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtOldPassword.Text))
            { SetStatus("Enter your current password.", Color.Red); return; }

            // Verify current password
            object check = DBHelper.ExecuteScalar(
                "SELECT COUNT(*) FROM Users WHERE UserID=@ID AND Password=@P",
                new SqlParameter[] {
                    new SqlParameter("@ID", LoginForm.CurrentUser.UserID),
                    new SqlParameter("@P",  txtOldPassword.Text) });

            if (Convert.ToInt32(check) == 0)
            { SetStatus("Current password is incorrect.", Color.Red); return; }

            if (!ValidationHelper.IsValidPassword(txtNewPassword.Text))
            { SetStatus("New password must be at least 6 characters.", Color.Red); return; }

            if (txtNewPassword.Text != txtConfirmPassword.Text)
            { SetStatus("New passwords do not match.", Color.Red); return; }

            DBHelper.ExecuteNonQuery(
                "UPDATE Users SET Password=@P WHERE UserID=@ID",
                new SqlParameter[] {
                    new SqlParameter("@P",  txtNewPassword.Text),
                    new SqlParameter("@ID", LoginForm.CurrentUser.UserID) });

            txtOldPassword.Clear();
            txtNewPassword.Clear();
            txtConfirmPassword.Clear();
            SetStatus("Password changed successfully.", Color.DarkGreen);
        }

        private void SetStatus(string msg, Color c)
        {
            lblStatus.Text = msg; lblStatus.ForeColor = c;
        }
    }
}
