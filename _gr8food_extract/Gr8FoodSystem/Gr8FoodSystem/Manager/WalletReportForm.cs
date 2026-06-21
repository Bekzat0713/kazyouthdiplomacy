using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;

namespace Gr8FoodSystem
{
    public class WalletReportForm : Form
    {
        private DataGridView dgvWallet;
        private ComboBox cmbCustomer, cmbMonth, cmbYear;
        private Button btnFilter, btnClear;
        private Label lblTotal;

        public WalletReportForm()
        {
            InitializeComponent();
            LoadCustomers();
            LoadReport();
        }

        private void InitializeComponent()
        {
            this.Text = "E-Wallet Report";
            this.Size = new Size(900, 560);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(0, 100, 180), Dock = DockStyle.Top, Height = 45 };
            pnlTop.Controls.Add(new Label
            {
                Text = "E-Wallet Top Up & Usage Report",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            Label MkL(string t, int x) => new Label
            {
                Text = t, Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(x, 58), Size = new Size(70, 22)
            };

            cmbCustomer = new ComboBox
            {
                Location = new Point(90, 55), Size = new Size(180, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };

            cmbMonth = new ComboBox
            {
                Location = new Point(320, 55), Size = new Size(110, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };
            cmbMonth.Items.Add("All Months");
            for (int m = 1; m <= 12; m++)
                cmbMonth.Items.Add(new DateTime(2000, m, 1).ToString("MMMM"));
            cmbMonth.SelectedIndex = 0;

            cmbYear = new ComboBox
            {
                Location = new Point(480, 55), Size = new Size(90, 26),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9)
            };
            cmbYear.Items.Add("All Years");
            for (int y = 2023; y <= DateTime.Now.Year + 1; y++)
                cmbYear.Items.Add(y.ToString());
            cmbYear.SelectedIndex = 0;

            btnFilter = new Button
            {
                Text = "Filter", Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(590, 54), Size = new Size(80, 28),
                BackColor = Color.FromArgb(0, 100, 180), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnFilter.FlatAppearance.BorderSize = 0;
            btnFilter.Click += (s, e) => LoadReport();

            btnClear = new Button
            {
                Text = "Clear", Font = new Font("Segoe UI", 9),
                Location = new Point(680, 54), Size = new Size(75, 28),
                BackColor = Color.Gray, ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnClear.FlatAppearance.BorderSize = 0;
            btnClear.Click += (s, e) =>
            {
                cmbCustomer.SelectedIndex = 0;
                cmbMonth.SelectedIndex = 0;
                cmbYear.SelectedIndex = 0;
                LoadReport();
            };

            dgvWallet = new DataGridView
            {
                Location = new Point(10, 92), Size = new Size(860, 390),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.White, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9),
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            ThemeHelper.StyleGrid(dgvWallet);

            lblTotal = new Label
            {
                Text = "",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(600, 492), Size = new Size(270, 24),
                ForeColor = Color.FromArgb(0, 100, 180),
                TextAlign = ContentAlignment.MiddleRight
            };

            this.Controls.AddRange(new Control[]
            {
                pnlTop,
                MkL("Customer:", 20), cmbCustomer,
                MkL("Month:", 290), cmbMonth,
                MkL("Year:", 450), cmbYear,
                btnFilter, btnClear, dgvWallet, lblTotal
            });
        }

        private void LoadCustomers()
        {
            DataTable dt = DBHelper.ExecuteQuery(
                "SELECT UserID, FullName FROM Users WHERE Role='Customer' AND IsActive=1 ORDER BY FullName");
            cmbCustomer.Items.Add("All Customers");
            foreach (DataRow r in dt.Rows)
                cmbCustomer.Items.Add(new { ID = Convert.ToInt32(r["UserID"]), Name = r["FullName"].ToString() });
            cmbCustomer.DisplayMember = "Name";
            cmbCustomer.SelectedIndex = 0;
        }

        private void LoadReport()
        {
            string where = "WHERE 1=1";
            var pList = new System.Collections.Generic.List<SqlParameter>();

            if (cmbCustomer.SelectedIndex > 0)
            {
                dynamic item = cmbCustomer.SelectedItem;
                where += " AND wt.CustomerID = @Cust";
                pList.Add(new SqlParameter("@Cust", (int)item.ID));
            }
            if (cmbMonth.SelectedIndex > 0)
            {
                where += " AND MONTH(wt.TransactionDate) = @Month";
                pList.Add(new SqlParameter("@Month", cmbMonth.SelectedIndex));
            }
            if (cmbYear.SelectedIndex > 0)
            {
                where += " AND YEAR(wt.TransactionDate) = @Year";
                pList.Add(new SqlParameter("@Year", int.Parse(cmbYear.Text)));
            }

            string q = $@"
                SELECT u.FullName      AS Customer,
                       wt.TransactionType AS Type,
                       wt.Amount        AS [Amount (RM)],
                       wt.Description,
                       wt.OrderID       AS [Order #],
                       CONVERT(varchar,wt.TransactionDate,120) AS [Date]
                FROM WalletTransactions wt
                JOIN Users u ON wt.CustomerID = u.UserID
                {where}
                ORDER BY wt.TransactionDate DESC";

            DataTable dt = DBHelper.ExecuteQuery(q, pList.ToArray());
            dgvWallet.DataSource = dt;

            decimal topUp = 0, spend = 0;
            foreach (DataRow r in dt.Rows)
            {
                string type = r["Type"].ToString();
                decimal amt = Convert.ToDecimal(r["Amount (RM)"]);
                if (type == "TopUp") topUp += amt;
                else spend += amt;
            }
            lblTotal.Text = $"Top Up: RM {topUp:F2}   |   Spend: RM {spend:F2}";
        }
    }
}

