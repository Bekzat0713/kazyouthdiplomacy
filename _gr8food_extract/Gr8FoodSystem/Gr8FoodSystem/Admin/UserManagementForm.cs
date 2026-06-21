using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Helpers;

namespace Gr8FoodSystem
{
    public class UserManagementForm : Form
    {
        private DataGridView dgvUsers;
        private TextBox txtLoginID, txtPassword, txtFullName, txtEmail, txtPhone;
        private ComboBox cmbRole;
        private Button btnAdd, btnEdit, btnDelete, btnClear;
        private Label lblStatus;
        private int selectedUserID = -1;

        public UserManagementForm()
        {
            InitializeComponent();
            LoadUsers();
        }

        private void InitializeComponent()
        {
            this.Text = "Manage Users";
            this.Size = new Size(900, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            // Header
            Panel pnlTop = new Panel
            {
                BackColor = ThemeHelper.Primary,
                Dock = DockStyle.Top,
                Height = 45
            };
            Label lblH = new Label
            {
                Text = "User Management",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            };
            pnlTop.Controls.Add(lblH);

            // Grid
            dgvUsers = new DataGridView
            {
                Location = new Point(10, 55),
                Size = new Size(870, 280),
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AllowUserToAddRows = false,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                Font = new Font("Segoe UI", 9),
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill
            };
            dgvUsers.SelectionChanged += DgvUsers_SelectionChanged;

            // Input section
            int lx = 20, tx = 130, ty = 350, gap = 34;
            Label MkLbl(string t, int y) => new Label
            {
                Text = t, Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(lx, y), Size = new Size(105, 24),
                ForeColor = Color.FromArgb(50, 50, 50)
            };
            TextBox MkTxt(int y) => new TextBox
            {
                Font = new Font("Segoe UI", 10),
                Location = new Point(tx, y), Size = new Size(170, 26)
            };

            txtLoginID  = MkTxt(ty);
            txtPassword = MkTxt(ty + gap);
            txtFullName = MkTxt(ty + gap * 2);
            txtEmail    = MkTxt(ty + gap * 3);
            txtPhone    = MkTxt(ty + gap * 4);

            cmbRole = new ComboBox
            {
                Font = new Font("Segoe UI", 10),
                Location = new Point(tx + 200, ty),
                Size = new Size(150, 26),
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbRole.Items.AddRange(new string[] { "Admin", "Manager", "Chef", "Customer" });
            cmbRole.SelectedIndex = 3;
            // Buttons
            btnAdd = MakeBtn("Add User", 20, 510, Color.FromArgb(0, 140, 60));
            btnAdd.Click += BtnAdd_Click;

            btnEdit = MakeBtn("Update", 140, 510, Color.FromArgb(0, 100, 180));
            btnEdit.Click += BtnEdit_Click;

            btnDelete = MakeBtn("Deactivate", 260, 510, Color.FromArgb(180, 30, 30));
            btnDelete.Click += BtnDelete_Click;

            btnClear = MakeBtn("Clear", 380, 510, Color.Gray);
            btnClear.Click += (s, e) => ClearInputs();

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(500, 516), Size = new Size(360, 22),
                ForeColor = Color.DarkGreen
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop, dgvUsers,
                MkLbl("Login ID:", ty), txtLoginID,
                MkLbl("Password:", ty + gap), txtPassword,
                MkLbl("Full Name:", ty + gap * 2), txtFullName,
                MkLbl("Email:", ty + gap * 3), txtEmail,
                MkLbl("Phone:", ty + gap * 4), txtPhone,
                new Label { Text = "Role:", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                             Location = new Point(330, ty), Size = new Size(60, 24),
                             ForeColor = Color.FromArgb(50,50,50) },
                cmbRole,
                btnAdd, btnEdit, btnDelete, btnClear, lblStatus
            });
        }

        private Button MakeBtn(string text, int x, int y, Color color)
        {
            var btn = new Button
            {
                Text = text, Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(x, y), Size = new Size(110, 32),
                BackColor = color, ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btn.FlatAppearance.BorderSize = 0;
            return btn;
        }

        private void LoadUsers()
        {
            string q = @"SELECT UserID, LoginID, Role, FullName, Email, PhoneNumber,
                                CASE WHEN IsActive=1 THEN 'Active' ELSE 'Inactive' END AS Status
                         FROM Users ORDER BY Role, FullName";
            dgvUsers.DataSource = DBHelper.ExecuteQuery(q);
            dgvUsers.Columns["UserID"].Visible = false;
        }

        private void DgvUsers_SelectionChanged(object sender, EventArgs e)
        {
            if (dgvUsers.SelectedRows.Count == 0) return;
            DataGridViewRow r = dgvUsers.SelectedRows[0];
            selectedUserID    = Convert.ToInt32(r.Cells["UserID"].Value);
            txtLoginID.Text   = r.Cells["LoginID"].Value.ToString();
            txtFullName.Text  = r.Cells["FullName"].Value.ToString();
            txtEmail.Text     = r.Cells["Email"].Value.ToString();
            txtPhone.Text     = r.Cells["PhoneNumber"].Value.ToString();
            cmbRole.Text      = r.Cells["Role"].Value.ToString();
            txtPassword.Text  = "";
        }

        private void BtnAdd_Click(object sender, EventArgs e)
        {
            if (!ValidateInputs(requirePassword: true)) return;

            // Check duplicate LoginID
            var check = DBHelper.ExecuteScalar(
                "SELECT COUNT(*) FROM Users WHERE LoginID=@L",
                new SqlParameter[] { new SqlParameter("@L", txtLoginID.Text.Trim()) });

            if (Convert.ToInt32(check) > 0)
            {
                ShowStatus("Login ID already exists.", Color.Red);
                return;
            }

            string q = @"INSERT INTO Users (LoginID,Password,Role,FullName,Email,PhoneNumber)
                         VALUES (@L,@P,@R,@F,@E,@Ph)";
            SqlParameter[] p =
            {
                new SqlParameter("@L",  txtLoginID.Text.Trim()),
                new SqlParameter("@P",  txtPassword.Text),
                new SqlParameter("@R",  cmbRole.Text),
                new SqlParameter("@F",  txtFullName.Text.Trim()),
                new SqlParameter("@E",  txtEmail.Text.Trim()),
                new SqlParameter("@Ph", txtPhone.Text.Trim())
            };
            DBHelper.ExecuteNonQuery(q, p);

            // If Customer, create wallet record
            if (cmbRole.Text == "Customer")
            {
                var newID = DBHelper.ExecuteScalar("SELECT MAX(UserID) FROM Users");
                DBHelper.ExecuteNonQuery(
                    "INSERT INTO Customers (CustomerID, WalletBalance) VALUES (@ID, 0)",
                    new SqlParameter[] { new SqlParameter("@ID", Convert.ToInt32(newID)) });
            }

            ShowStatus("User added successfully.", Color.DarkGreen);
            ClearInputs();
            LoadUsers();
        }

        private void BtnEdit_Click(object sender, EventArgs e)
        {
            if (selectedUserID == -1) { ShowStatus("Select a user first.", Color.Red); return; }
            if (!ValidateInputs(requirePassword: false)) return;

            string q = @"UPDATE Users SET Role=@R, FullName=@F, Email=@E, PhoneNumber=@Ph
                         WHERE UserID=@ID";
            SqlParameter[] p =
            {
                new SqlParameter("@R",   cmbRole.Text),
                new SqlParameter("@F",   txtFullName.Text.Trim()),
                new SqlParameter("@E",   txtEmail.Text.Trim()),
                new SqlParameter("@Ph",  txtPhone.Text.Trim()),
                new SqlParameter("@ID",  selectedUserID)
            };

            if (!string.IsNullOrWhiteSpace(txtPassword.Text))
            {
                DBHelper.ExecuteNonQuery(
                    "UPDATE Users SET Password=@P WHERE UserID=@ID",
                    new SqlParameter[] {
                        new SqlParameter("@P",  txtPassword.Text),
                        new SqlParameter("@ID", selectedUserID) });
            }

            DBHelper.ExecuteNonQuery(q, p);
            ShowStatus("User updated successfully.", Color.DarkGreen);
            LoadUsers();
        }

        private void BtnDelete_Click(object sender, EventArgs e)
        {
            if (selectedUserID == -1) { ShowStatus("Select a user first.", Color.Red); return; }

            if (MessageBox.Show("Deactivate this user?", "Confirm",
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
            {
                DBHelper.ExecuteNonQuery(
                    "UPDATE Users SET IsActive=0 WHERE UserID=@ID",
                    new SqlParameter[] { new SqlParameter("@ID", selectedUserID) });
                ShowStatus("User deactivated.", Color.DarkGreen);
                ClearInputs();
                LoadUsers();
            }
        }

        private bool ValidateInputs(bool requirePassword)
        {
            if (ValidationHelper.IsEmpty(txtLoginID.Text))
            { ShowStatus("Login ID is required.", Color.Red); return false; }

            if (!ValidationHelper.IsValidLoginID(txtLoginID.Text.Trim()))
            { ShowStatus("Login ID: 4-20 alphanumeric characters only.", Color.Red); return false; }

            if (requirePassword && !ValidationHelper.IsValidPassword(txtPassword.Text))
            { ShowStatus("Password must be at least 6 characters.", Color.Red); return false; }

            if (ValidationHelper.IsEmpty(txtFullName.Text))
            { ShowStatus("Full Name is required.", Color.Red); return false; }

            if (!ValidationHelper.IsValidEmail(txtEmail.Text.Trim()))
            { ShowStatus("Enter a valid email address.", Color.Red); return false; }

            if (!ValidationHelper.IsValidPhone(txtPhone.Text.Trim()))
            { ShowStatus("Phone: 10-11 digits only.", Color.Red); return false; }

            return true;
        }

        private void ClearInputs()
        {
            txtLoginID.Clear(); txtPassword.Clear(); txtFullName.Clear();
            txtEmail.Clear(); txtPhone.Clear();
            cmbRole.SelectedIndex = 3;
            selectedUserID = -1;
        }

        private void ShowStatus(string msg, Color color)
        {
            lblStatus.Text = msg;
            lblStatus.ForeColor = color;
        }
    }
}

