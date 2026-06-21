using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;
using Gr8FoodSystem.Helpers;

namespace Gr8FoodSystem
{
    public class MenuManagementForm : Form
    {
        private DataGridView dgvMenu;
        private TextBox txtName, txtDesc, txtPrice;
        private ComboBox cmbCategory, cmbStatus;
        private Button btnAdd, btnEdit, btnDelete, btnToggle, btnClear;
        private Label lblStatus;
        private int selectedMenuItemID = -1;

        public MenuManagementForm()
        {
            InitializeComponent();
            LoadMenu();
        }

        private void InitializeComponent()
        {
            this.Text = "Menu Management";
            this.Size = new Size(900, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(0, 140, 60), Dock = DockStyle.Top, Height = 45 };
            pnlTop.Controls.Add(new Label
            {
                Text = "Menu Management",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            dgvMenu = new DataGridView
            {
                Location = new Point(10, 55), Size = new Size(860, 280),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.White, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9),
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            ThemeHelper.StyleGrid(dgvMenu);
            dgvMenu.SelectionChanged += DgvMenu_SelectionChanged;

            // Input fields
            Label MkL(string t, int x, int y) => new Label
            {
                Text = t, Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(x, y), Size = new Size(90, 22),
                ForeColor = Color.FromArgb(50, 50, 50)
            };
            TextBox MkT(int x, int y, int w = 180) => new TextBox
            {
                Font = new Font("Segoe UI", 10),
                Location = new Point(x, y), Size = new Size(w, 26)
            };

            int fy = 350;
            txtName  = MkT(100, fy);
            txtPrice = MkT(100, fy + 34, 100);
            txtDesc  = MkT(100, fy + 68, 550);

            cmbCategory = new ComboBox
            {
                Font = new Font("Segoe UI", 10),
                Location = new Point(380, fy), Size = new Size(130, 26),
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbCategory.Items.AddRange(new string[] { "Breakfast", "Lunch", "Dinner", "Snacks", "Drinks" });
            cmbCategory.SelectedIndex = 0;

            cmbStatus = new ComboBox
            {
                Font = new Font("Segoe UI", 10),
                Location = new Point(560, fy), Size = new Size(150, 26),
                DropDownStyle = ComboBoxStyle.DropDownList
            };
            cmbStatus.Items.AddRange(new string[] { "Available", "Not Available" });
            cmbStatus.SelectedIndex = 0;

            // Buttons
            btnAdd    = MkBtn("Add Item",   20,  510, Color.FromArgb(0, 140, 60));
            btnEdit   = MkBtn("Update",    140,  510, Color.FromArgb(0, 100, 180));
            btnDelete = MkBtn("Delete",    260,  510, Color.FromArgb(180, 30, 30));
            btnToggle = MkBtn("Toggle Status", 380, 510, Color.FromArgb(160, 90, 0));
            btnClear  = MkBtn("Clear",     510,  510, Color.Gray);

            btnAdd.Click    += BtnAdd_Click;
            btnEdit.Click   += BtnEdit_Click;
            btnDelete.Click += BtnDelete_Click;
            btnToggle.Click += BtnToggle_Click;
            btnClear.Click  += (s, e) => ClearInputs();

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(630, 516), Size = new Size(250, 22),
                ForeColor = Color.DarkGreen
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop, dgvMenu,
                MkL("Item Name:", 10, fy), txtName,
                MkL("Price (RM):", 10, fy+34), txtPrice,
                MkL("Category:", 295, fy), cmbCategory,
                MkL("Status:", 530, fy), cmbStatus,
                MkL("Description:", 10, fy+68), txtDesc,
                btnAdd, btnEdit, btnDelete, btnToggle, btnClear, lblStatus
            });
        }

        private Button MkBtn(string t, int x, int y, Color c)
        {
            var b = new Button
            {
                Text = t, Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(x, y), Size = new Size(110, 32),
                BackColor = c, ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            b.FlatAppearance.BorderSize = 0;
            return b;
        }

        private void LoadMenu()
        {
            string q = @"SELECT m.MenuItemID, m.ItemName, m.Description,
                                m.Price, m.Category, m.Status
                         FROM MenuItems m
                         WHERE m.ChefID = @ChefID
                         ORDER BY m.Category, m.ItemName";
            DataTable dt = DBHelper.ExecuteQuery(q,
                new SqlParameter[] { new SqlParameter("@ChefID", LoginForm.CurrentUser.UserID) });
            dgvMenu.DataSource = dt;
            if (dgvMenu.Columns.Contains("MenuItemID"))
                dgvMenu.Columns["MenuItemID"].Visible = false;
        }

        private void DgvMenu_SelectionChanged(object sender, EventArgs e)
        {
            if (dgvMenu.SelectedRows.Count == 0) return;
            DataGridViewRow r = dgvMenu.SelectedRows[0];
            selectedMenuItemID = Convert.ToInt32(r.Cells["MenuItemID"].Value);
            txtName.Text       = r.Cells["ItemName"].Value.ToString();
            txtDesc.Text       = r.Cells["Description"].Value.ToString();
            txtPrice.Text      = r.Cells["Price"].Value.ToString();
            cmbCategory.Text   = r.Cells["Category"].Value.ToString();
            cmbStatus.Text     = r.Cells["Status"].Value.ToString();
        }

        private void BtnAdd_Click(object sender, EventArgs e)
        {
            if (!ValidateInputs()) return;
            if (!ValidationHelper.IsValidPrice(txtPrice.Text, out decimal price))
            { ShowMsg("Enter a valid price (e.g. 8.50).", Color.Red); return; }

            string q = @"INSERT INTO MenuItems (ItemName,Description,Price,Category,Status,ChefID)
                         VALUES (@N,@D,@P,@C,@S,@CID)";
            SqlParameter[] p =
            {
                new SqlParameter("@N",   txtName.Text.Trim()),
                new SqlParameter("@D",   txtDesc.Text.Trim()),
                new SqlParameter("@P",   price),
                new SqlParameter("@C",   cmbCategory.Text),
                new SqlParameter("@S",   cmbStatus.Text),
                new SqlParameter("@CID", LoginForm.CurrentUser.UserID)
            };
            DBHelper.ExecuteNonQuery(q, p);
            ShowMsg("Menu item added.", Color.DarkGreen);
            ClearInputs(); LoadMenu();
        }

        private void BtnEdit_Click(object sender, EventArgs e)
        {
            if (selectedMenuItemID == -1) { ShowMsg("Select an item first.", Color.Red); return; }
            if (!ValidateInputs()) return;
            if (!ValidationHelper.IsValidPrice(txtPrice.Text, out decimal price))
            { ShowMsg("Enter a valid price.", Color.Red); return; }

            string q = @"UPDATE MenuItems
                         SET ItemName=@N, Description=@D, Price=@P, Category=@C, Status=@S
                         WHERE MenuItemID=@ID AND ChefID=@CID";
            SqlParameter[] p =
            {
                new SqlParameter("@N",   txtName.Text.Trim()),
                new SqlParameter("@D",   txtDesc.Text.Trim()),
                new SqlParameter("@P",   price),
                new SqlParameter("@C",   cmbCategory.Text),
                new SqlParameter("@S",   cmbStatus.Text),
                new SqlParameter("@ID",  selectedMenuItemID),
                new SqlParameter("@CID", LoginForm.CurrentUser.UserID)
            };
            DBHelper.ExecuteNonQuery(q, p);
            ShowMsg("Menu item updated.", Color.DarkGreen);
            LoadMenu();
        }

        private void BtnDelete_Click(object sender, EventArgs e)
        {
            if (selectedMenuItemID == -1) { ShowMsg("Select an item first.", Color.Red); return; }
            if (MessageBox.Show("Delete this menu item?", "Confirm",
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
            {
                DBHelper.ExecuteNonQuery("DELETE FROM MenuItems WHERE MenuItemID=@ID AND ChefID=@CID",
                    new SqlParameter[] {
                        new SqlParameter("@ID",  selectedMenuItemID),
                        new SqlParameter("@CID", LoginForm.CurrentUser.UserID) });
                ShowMsg("Item deleted.", Color.DarkGreen);
                ClearInputs(); LoadMenu();
            }
        }

        private void BtnToggle_Click(object sender, EventArgs e)
        {
            if (selectedMenuItemID == -1) { ShowMsg("Select an item first.", Color.Red); return; }
            string newStatus = cmbStatus.Text == "Available" ? "Not Available" : "Available";
            DBHelper.ExecuteNonQuery("UPDATE MenuItems SET Status=@S WHERE MenuItemID=@ID",
                new SqlParameter[] {
                    new SqlParameter("@S",  newStatus),
                    new SqlParameter("@ID", selectedMenuItemID) });
            ShowMsg($"Status changed to: {newStatus}", Color.DarkGreen);
            LoadMenu();
        }

        private bool ValidateInputs()
        {
            if (ValidationHelper.IsEmpty(txtName.Text))
            { ShowMsg("Item name is required.", Color.Red); return false; }
            return true;
        }

        private void ClearInputs()
        {
            txtName.Clear(); txtDesc.Clear(); txtPrice.Clear();
            cmbCategory.SelectedIndex = 0; cmbStatus.SelectedIndex = 0;
            selectedMenuItemID = -1;
        }

        private void ShowMsg(string msg, Color c)
        {
            lblStatus.Text = msg; lblStatus.ForeColor = c;
        }
    }
}


