using System.Drawing;
using System.Windows.Forms;

namespace Gr8FoodSystem
{
    public static class ThemeHelper
    {
        public static Color Primary     = Color.FromArgb(41, 128, 185);
        public static Color PrimaryDark = Color.FromArgb(21,  98, 155);
        public static Color Danger      = Color.FromArgb(192,  57,  43);
        public static Color Success     = Color.FromArgb( 39, 174,  96);
        public static Color Dark        = Color.FromArgb( 44,  62,  80);
        public static Color White       = Color.White;
        public static Color TextGray    = Color.FromArgb(127, 140, 141);
        public static Color TextDark    = Color.FromArgb( 44,  62,  80);

        public static Font FontTitle = new Font("Segoe UI", 16, FontStyle.Bold);
        public static Font FontHead  = new Font("Segoe UI", 11, FontStyle.Bold);
        public static Font FontBody  = new Font("Segoe UI", 10);
        public static Font FontSmall = new Font("Segoe UI",  9);
        public static Font FontLabel = new Font("Segoe UI",  9, FontStyle.Bold);

        public static void ApplyForm(Form f)
        {
            f.BackColor     = White;
            f.Font          = FontBody;
            f.StartPosition = FormStartPosition.CenterScreen;
        }

        public static Panel MakeHeader(string title, string sub = "")
        {
            var pnl = new Panel { BackColor = Dark, Dock = DockStyle.Top, Height = sub == "" ? 55 : 75 };
            pnl.Controls.Add(new Label { Text = title, Font = FontHead, ForeColor = White,
                Location = new Point(0, sub==""?14:8), Size = new Size(2000,30), TextAlign = ContentAlignment.MiddleCenter });
            if (sub != "")
                pnl.Controls.Add(new Label { Text = sub, Font = FontSmall, ForeColor = Color.FromArgb(149,165,166),
                    Location = new Point(0, 40), Size = new Size(2000,22), TextAlign = ContentAlignment.MiddleCenter });
            return pnl;
        }

        public static Button MakeMenuButton(string text, int x, int y)
        {
            var b = new Button { Text=text, Font=FontHead, Location=new Point(x,y), Size=new Size(400,52),
                BackColor=Primary, ForeColor=White, FlatStyle=FlatStyle.Flat, Cursor=Cursors.Hand };
            b.FlatAppearance.BorderSize=0; b.FlatAppearance.MouseOverBackColor=PrimaryDark;
            return b;
        }

        public static Button MakeButton(string text, int x, int y, int w=110, int h=32, Color? color=null)
        {
            var b = new Button { Text=text, Font=FontSmall, Location=new Point(x,y), Size=new Size(w,h),
                BackColor=color??Primary, ForeColor=White, FlatStyle=FlatStyle.Flat, Cursor=Cursors.Hand };
            b.FlatAppearance.BorderSize=0;
            return b;
        }

        public static void StyleGrid(DataGridView g)
        {
            g.BackgroundColor=White; g.BorderStyle=BorderStyle.None; g.Font=FontSmall;
            g.RowHeadersVisible=false; g.AllowUserToAddRows=false; g.AllowUserToResizeRows=false;
            g.ReadOnly=true; g.SelectionMode=DataGridViewSelectionMode.FullRowSelect;
            g.AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill;
            g.GridColor=Color.FromArgb(220,220,220);
            g.DefaultCellStyle.BackColor=White; g.DefaultCellStyle.ForeColor=TextDark;
            g.DefaultCellStyle.Padding=new Padding(4,0,4,0);
            g.AlternatingRowsDefaultCellStyle.BackColor=Color.FromArgb(245,248,252);
            g.ColumnHeadersDefaultCellStyle.BackColor=Dark; g.ColumnHeadersDefaultCellStyle.ForeColor=White;
            g.ColumnHeadersDefaultCellStyle.Font=FontLabel; g.ColumnHeadersDefaultCellStyle.Padding=new Padding(4,6,4,6);
            g.ColumnHeadersHeight=36; g.ColumnHeadersHeightSizeMode=DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            g.EnableHeadersVisualStyles=false;
        }
    }
}
