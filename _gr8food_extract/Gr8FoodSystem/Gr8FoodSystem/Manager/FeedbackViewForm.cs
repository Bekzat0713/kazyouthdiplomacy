using System;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Windows.Forms;
using Gr8FoodSystem.Database;

namespace Gr8FoodSystem
{
    public class FeedbackViewForm : Form
    {
        private DataGridView dgvFeedback;
        private TextBox txtResponse;
        private Button btnRespond;
        private Label lblSelected, lblStatus;
        private int selectedFeedbackID = -1;

        public FeedbackViewForm()
        {
            InitializeComponent();
            LoadFeedback();
        }

        private void InitializeComponent()
        {
            this.Text = "Customer Feedback";
            this.Size = new Size(900, 580);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;

            Panel pnlTop = new Panel { BackColor = Color.FromArgb(0, 100, 180), Dock = DockStyle.Top, Height = 45 };
            pnlTop.Controls.Add(new Label
            {
                Text = "Customer Feedback — View & Respond",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White, Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter
            });

            dgvFeedback = new DataGridView
            {
                Location = new Point(10, 55), Size = new Size(860, 310),
                ReadOnly = true, AllowUserToAddRows = false,
                BackgroundColor = Color.White, BorderStyle = BorderStyle.None,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9),
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            ThemeHelper.StyleGrid(dgvFeedback);
            dgvFeedback.SelectionChanged += DgvFeedback_SelectionChanged;

            lblSelected = new Label
            {
                Text = "Select a feedback row above to respond.",
                Font = new Font("Segoe UI", 9, FontStyle.Italic),
                Location = new Point(10, 375), Size = new Size(860, 20),
                ForeColor = Color.Gray
            };

            Label lblR = new Label
            {
                Text = "Manager Response:",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(10, 400), Size = new Size(140, 22)
            };

            txtResponse = new TextBox
            {
                Location = new Point(10, 424), Size = new Size(740, 60),
                Multiline = true, Font = new Font("Segoe UI", 10),
                ScrollBars = ScrollBars.Vertical
            };

            btnRespond = new Button
            {
                Text = "Submit Response",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(762, 424), Size = new Size(108, 60),
                BackColor = Color.FromArgb(0, 100, 180), ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand
            };
            btnRespond.FlatAppearance.BorderSize = 0;
            btnRespond.Click += BtnRespond_Click;

            lblStatus = new Label
            {
                Text = "", Font = new Font("Segoe UI", 9),
                Location = new Point(10, 494), Size = new Size(860, 22),
                ForeColor = Color.DarkGreen, TextAlign = ContentAlignment.MiddleCenter
            };

            this.Controls.AddRange(new Control[]
            { pnlTop, dgvFeedback, lblSelected, lblR, txtResponse, btnRespond, lblStatus });
        }

        private void LoadFeedback()
        {
            string q = @"
                SELECT f.FeedbackID,
                       u.FullName              AS Customer,
                       f.OrderID               AS [Order #],
                       f.Rating,
                       f.Message,
                       f.FeedbackDate,
                       ISNULL(f.ManagerResponse,'(No response yet)') AS [Manager Response],
                       f.ResponseDate
                FROM Feedback f
                JOIN Users u ON f.CustomerID = u.UserID
                ORDER BY f.FeedbackDate DESC";
            dgvFeedback.DataSource = DBHelper.ExecuteQuery(q);
            if (dgvFeedback.Columns.Contains("FeedbackID"))
                dgvFeedback.Columns["FeedbackID"].Visible = false;
        }

        private void DgvFeedback_SelectionChanged(object sender, EventArgs e)
        {
            if (dgvFeedback.SelectedRows.Count == 0) return;
            DataGridViewRow r = dgvFeedback.SelectedRows[0];
            selectedFeedbackID = Convert.ToInt32(r.Cells["FeedbackID"].Value);
            string existing = r.Cells["Manager Response"].Value.ToString();
            txtResponse.Text = existing == "(No response yet)" ? "" : existing;
            lblSelected.Text = $"Responding to feedback from: {r.Cells["Customer"].Value}";
            lblSelected.ForeColor = Color.FromArgb(0, 100, 180);
        }

        private void BtnRespond_Click(object sender, EventArgs e)
        {
            if (selectedFeedbackID == -1)
            { lblStatus.Text = "Please select a feedback row first."; lblStatus.ForeColor = Color.Red; return; }

            if (string.IsNullOrWhiteSpace(txtResponse.Text))
            { lblStatus.Text = "Response cannot be empty."; lblStatus.ForeColor = Color.Red; return; }

            string q = @"UPDATE Feedback
                         SET ManagerResponse = @R, ResponseDate = GETDATE()
                         WHERE FeedbackID = @ID";
            SqlParameter[] p =
            {
                new SqlParameter("@R",  txtResponse.Text.Trim()),
                new SqlParameter("@ID", selectedFeedbackID)
            };
            DBHelper.ExecuteNonQuery(q, p);
            lblStatus.Text = "Response submitted successfully.";
            lblStatus.ForeColor = Color.DarkGreen;
            LoadFeedback();
            txtResponse.Clear();
            selectedFeedbackID = -1;
        }
    }
}

