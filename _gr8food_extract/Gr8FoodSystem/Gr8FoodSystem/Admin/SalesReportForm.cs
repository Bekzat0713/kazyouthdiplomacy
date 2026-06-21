using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;

namespace Gr8FoodSystem
{
    public class SalesReportForm : Form
    {
        private DataGridView dgvReport;
        private ComboBox cmbMonth, cmbYear, cmbCategory, cmbChef;
        private Button btnFilter, btnClear;
        private Label lblTotal;

        public SalesReportForm()
        {
            InitializeComponent();
            LoadChefs();
            LoadReport();
        }

        private void InitializeComponent()
        {
            this.Text = "Sales Report";
            this.Size = new Size(900, 580);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            // Header
            Panel pnlTop = new Panel { BackColor = Color.FromArgb(200, 30, 30), Dock = DockStyle.Top, Height = 45 };
            pnlTop.Controls.Add(new Label
            {
                Text = "Sales Report",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            // Filter row
            Label MkLbl(string t, int x) => new Label
            {
                Text = t, Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(x, 58), Size = new Size(60, 22),
                ForeColor = Color.FromArgb(50, 50, 50)
            };

            cmbMonth = new ComboBox
            {
                Location = new Point(90, 55), Size = new Size(80, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };
            cmbMonth.Items.Add("All Months");
            for (int m = 1; m <= 12; m++)
                cmbMonth.Items.Add(new DateTime(2000, m, 1).ToString("MMMM"));
            cmbMonth.SelectedIndex = 0;

            cmbYear = new ComboBox
            {
                Location = new Point(220, 55), Size = new Size(80, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };
            cmbYear.Items.Add("All Years");
            for (int y = 2023; y <= DateTime.Now.Year + 1; y++)
                cmbYear.Items.Add(y.ToString());
            cmbYear.SelectedIndex = 0;

            cmbCategory = new ComboBox
            {
                Location = new Point(350, 55), Size = new Size(110, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };
            cmbCategory.Items.AddRange(new string[] { "All Categories", "Breakfast", "Lunch", "Dinner", "Snacks", "Drinks" });
            cmbCategory.SelectedIndex = 0;

            cmbChef = new ComboBox
            {
                Location = new Point(510, 55), Size = new Size(150, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };

            btnFilter = new Button
            {
                Text = "Filter", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(675, 54), Size = new Size(80, 28),
                BackColor = Color.FromArgb(200, 30, 30), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnFilter.FlatAppearance.BorderSize = 0;
            btnFilter.Click += (s, e) => LoadReport();

            btnClear = new Button
            {
                Text = "Clear", Font = new Font("Segoe UI", 9),
                Location = new Point(765, 54), Size = new Size(75, 28),
                BackColor = Color.Gray, ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnClear.FlatAppearance.BorderSize = 0;
            btnClear.Click += (s, e) =>
            {
                cmbMonth.SelectedIndex = 0; cmbYear.SelectedIndex = 0;
                cmbCategory.SelectedIndex = 0; cmbChef.SelectedIndex = 0;
                LoadReport();
            };

            // Grid
            dgvReport = new DataGridView
            {
                Location = new Point(10, 92),
                Size = new Size(860, 400),
                ReadOnly = true,
                AllowUserToAddRows = false,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9),
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            ThemeHelper.StyleGrid(dgvReport);

            lblTotal = new Label
            {
                Text = "Total Sales: RM 0.00",
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                Location = new Point(650, 500),
                Size = new Size(220, 28),
                ForeColor = Color.FromArgb(200, 30, 30),
                TextAlign = ContentAlignment.MiddleRight
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop,
                MkLbl("Month:", 20), cmbMonth,
                MkLbl("Year:", 180), cmbYear,
                MkLbl("Category:", 310), cmbCategory,
                MkLbl("Chef:", 480), cmbChef,
                btnFilter, btnClear, dgvReport, lblTotal
            });
        }

        private void LoadChefs()
        {
            DataTable dt = DBHelper.ExecuteQuery("SELECT UserID, FullName FROM Users WHERE Role='Chef' AND IsActive=1");
            cmbChef.Items.Add("All Chefs");
            foreach (DataRow r in dt.Rows)
                cmbChef.Items.Add(new { ID = r["UserID"], Name = r["FullName"].ToString() });
            cmbChef.SelectedIndex = 0;
            cmbChef.DisplayMember = "Name";
        }

        private void LoadReport()
        {
            string where = "WHERE o.Status = 'Completed'";
            var pList = new System.Collections.Generic.List<SqlParameter>();

            if (cmbMonth.SelectedIndex > 0)
            {
                where += " AND MONTH(o.OrderDate) = @Month";
                pList.Add(new SqlParameter("@Month", cmbMonth.SelectedIndex));
            }

            if (cmbYear.SelectedIndex > 0)
            {
                where += " AND YEAR(o.OrderDate) = @Year";
                pList.Add(new SqlParameter("@Year", int.Parse(cmbYear.Text)));
            }

            if (cmbCategory.SelectedIndex > 0)
            {
                where += " AND mi.Category = @Cat";
                pList.Add(new SqlParameter("@Cat", cmbCategory.Text));
            }

            if (cmbChef.SelectedIndex > 0 && cmbChef.SelectedItem.GetType().GetProperty("ID") != null)
            {
                dynamic item = cmbChef.SelectedItem;
                where += " AND mi.ChefID = @Chef";
                pList.Add(new SqlParameter("@Chef", (int)item.ID));
            }

            string q = $@"
                SELECT o.OrderID,
                       u.FullName        AS Customer,
                       mi.ItemName       AS Item,
                       mi.Category,
                       oi.Quantity,
                       oi.UnitPrice      AS [Unit Price (RM)],
                       oi.Subtotal       AS [Subtotal (RM)],
                       uc.FullName       AS Chef,
                       CONVERT(varchar,o.OrderDate,103) AS [Order Date]
                FROM Orders o
                JOIN OrderItems oi ON o.OrderID = oi.OrderID
                JOIN MenuItems mi  ON oi.MenuItemID = mi.MenuItemID
                JOIN Users u       ON o.CustomerID = u.UserID
                JOIN Users uc      ON mi.ChefID = uc.UserID
                {where}
                ORDER BY o.OrderDate DESC";

            DataTable dt = DBHelper.ExecuteQuery(q, pList.ToArray());
            dgvReport.DataSource = dt;

            decimal total = 0;
            foreach (DataRow row in dt.Rows)
                total += Convert.ToDecimal(row["Subtotal (RM)"]);
            lblTotal.Text = $"Total Sales: RM {total:F2}";
        }
    }
}


