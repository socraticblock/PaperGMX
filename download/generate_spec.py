#!/usr/bin/env python3
"""
EasyGMX Paper Trading — Complete Technical Specification PDF
Every single detail needed to build this product.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm, inch
from reportlab.lib.colors import HexColor, black, white, gray
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.colors import Color
import datetime

# ─── Colors ────────────────────────────────────────────────
C_BG = HexColor("#0a0a0f")
C_PRIMARY = HexColor("#418cf5")
C_GREEN = HexColor("#22c55e")
C_RED = HexColor("#ef4444")
C_DARK = HexColor("#1a1a2e")
C_TEXT = HexColor("#2d2d3f")
C_MUTED = HexColor("#6b6b80")
C_TABLE_BG = HexColor("#f5f7fa")
C_TABLE_HEADER = HexColor("#418cf5")
C_TABLE_BORDER = HexColor("#d0d5dd")

# ─── Page Setup ────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

doc = SimpleDocTemplate(
    "/home/z/my-project/download/EasyGMX_Paper_Trading_Specification.pdf",
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=MARGIN,
    title="EasyGMX Paper Trading — Complete Technical Specification",
    author="EasyGMX Team",
)

# ─── Styles ────────────────────────────────────────────────
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name="CoverTitle",
    fontName="Helvetica-Bold",
    fontSize=32,
    leading=38,
    textColor=HexColor("#1a1a2e"),
    alignment=TA_CENTER,
    spaceAfter=8,
))

styles.add(ParagraphStyle(
    name="CoverSub",
    fontName="Helvetica",
    fontSize=14,
    leading=20,
    textColor=C_MUTED,
    alignment=TA_CENTER,
    spaceAfter=6,
))

styles.add(ParagraphStyle(
    name="H1",
    fontName="Helvetica-Bold",
    fontSize=22,
    leading=28,
    textColor=C_PRIMARY,
    spaceBefore=24,
    spaceAfter=10,
))

styles.add(ParagraphStyle(
    name="H2",
    fontName="Helvetica-Bold",
    fontSize=16,
    leading=22,
    textColor=HexColor("#2d2d3f"),
    spaceBefore=18,
    spaceAfter=8,
))

styles.add(ParagraphStyle(
    name="H3",
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=18,
    textColor=HexColor("#3d3d5f"),
    spaceBefore=12,
    spaceAfter=6,
))

styles.add(ParagraphStyle(
    name="Body",
    fontName="Helvetica",
    fontSize=10,
    leading=15,
    textColor=C_TEXT,
    alignment=TA_JUSTIFY,
    spaceAfter=6,
))

styles.add(ParagraphStyle(
    name="BodyBold",
    fontName="Helvetica-Bold",
    fontSize=10,
    leading=15,
    textColor=C_TEXT,
    spaceAfter=6,
))

styles.add(ParagraphStyle(
    name="Small",
    fontName="Helvetica",
    fontSize=9,
    leading=13,
    textColor=C_MUTED,
    spaceAfter=4,
))

styles.add(ParagraphStyle(
    name="CodeBlock",
    fontName="Courier",
    fontSize=8.5,
    leading=12,
    textColor=HexColor("#1a1a2e"),
    backColor=HexColor("#f0f2f5"),
    spaceAfter=6,
    spaceBefore=4,
    leftIndent=10,
    rightIndent=10,
))

styles.add(ParagraphStyle(
    name="Formula",
    fontName="Courier-Bold",
    fontSize=9,
    leading=13,
    textColor=HexColor("#2d2d5f"),
    backColor=HexColor("#f0f2f5"),
    spaceAfter=8,
    spaceBefore=4,
    leftIndent=10,
    rightIndent=10,
))

styles.add(ParagraphStyle(
    name="Note",
    fontName="Helvetica-Oblique",
    fontSize=9.5,
    leading=14,
    textColor=HexColor("#4a6fa5"),
    leftIndent=15,
    rightIndent=15,
    spaceBefore=6,
    spaceAfter=6,
))

styles.add(ParagraphStyle(
    name="BulletText",
    fontName="Helvetica",
    fontSize=10,
    leading=15,
    textColor=C_TEXT,
    leftIndent=20,
    bulletIndent=8,
    spaceAfter=3,
))

styles.add(ParagraphStyle(
    name="TOCEntry",
    fontName="Helvetica",
    fontSize=11,
    leading=18,
    textColor=C_TEXT,
))

# ─── Helper Functions ──────────────────────────────────────

def h1(text):
    return Paragraph(text, styles["H1"])

def h2(text):
    return Paragraph(text, styles["H2"])

def h3(text):
    return Paragraph(text, styles["H3"])

def p(text):
    return Paragraph(text, styles["Body"])

def pb(text):
    return Paragraph(text, styles["BodyBold"])

def sm(text):
    return Paragraph(text, styles["Small"])

def code(text):
    return Paragraph(text.replace("\n", "<br/>").replace(" ", "&nbsp;"), styles["CodeBlock"])

def formula(text):
    return Paragraph(text, styles["Formula"])

def note(text):
    return Paragraph(text, styles["Note"])

def bullet(text):
    return Paragraph(f"\u2022 {text}", styles["BulletText"])

def spacer(h=6):
    return Spacer(1, h)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=C_TABLE_BORDER, spaceAfter=8, spaceBefore=8)

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    data = [headers] + rows
    avail = PAGE_W - 2 * MARGIN
    if col_widths is None:
        n = len(headers)
        col_widths = [avail / n] * n
    else:
        total = sum(col_widths)
        col_widths = [w / total * avail for w in col_widths]

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_TABLE_HEADER),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("LEADING", (0, 0), (-1, -1), 12),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 1), (-1, -1), C_TABLE_BG),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_TABLE_BG, white]),
        ("GRID", (0, 0), (-1, -1), 0.5, C_TABLE_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


# ═══════════════════════════════════════════════════════════
# DOCUMENT CONTENT
# ═══════════════════════════════════════════════════════════

story = []

# ─── COVER PAGE ────────────────────────────────────────────
story.append(Spacer(1, 80))
story.append(Paragraph("EasyGMX", styles["CoverTitle"]))
story.append(Paragraph("Paper Trading", ParagraphStyle(
    "CoverTitle2", parent=styles["CoverTitle"], fontSize=28, textColor=C_PRIMARY
)))
story.append(Spacer(1, 20))
story.append(Paragraph("Complete Technical Specification", styles["CoverSub"]))
story.append(Paragraph("Every Detail. Every Formula. Every Screen.", styles["CoverSub"]))
story.append(Spacer(1, 30))
story.append(Paragraph(f"Version 1.0 \u2022 {datetime.date.today().strftime('%B %d, %Y')}", styles["CoverSub"]))
story.append(Paragraph("Powered by GMX V2 on Arbitrum", styles["CoverSub"]))
story.append(Spacer(1, 60))

cover_summary = [
    ["Scope", "Frontend-only paper trading simulator for GMX V2 perpetual futures"],
    ["Target User", "People curious about DeFi trading but not ready to risk real funds"],
    ["Core Promise", "Try GMX perps for free. Same prices, same fees, same experience. Fake money."],
    ["Tech Stack", "Next.js 16, TypeScript, Zustand, lightweight-charts, GMX REST API"],
    ["Persistence", "localStorage only (no accounts, no backend, no logins)"],
    ["Markets", "ETH/USD, BTC/USD, SOL/USD, ARB/USD perpetuals on Arbitrum"],
    ["Modes", "Classic (full wallet simulation) + One-Click Trading (1CT)"],
    ["Fee Accuracy", "Position fee, borrow fee, funding rate, execution fee, liquidation fee \u2014 all from GMX API"],
]
story.append(make_table(["Attribute", "Detail"], cover_summary, [1, 4]))
story.append(PageBreak())

# ─── TABLE OF CONTENTS (manual) ───────────────────────────
story.append(Paragraph("Table of Contents", styles["H1"]))
story.append(spacer(10))

toc_items = [
    "1. Product Vision & Core Promise",
    "2. User Flow \u2014 Every Screen, Every Click",
    "   2.1 Landing Page",
    "   2.2 Market Selection Screen",
    "   2.3 Trade Setup Screen (Classic Mode)",
    "   2.4 Fake Wallet Popup \u2014 Approval",
    "   2.5 Fake Wallet Popup \u2014 Order Signing",
    "   2.6 Keeper Wait Screen",
    "   2.7 Position Live Screen",
    "   2.8 Close Position Flow",
    "   2.9 P&L Result Card",
    "   2.10 One-Click Trading Mode",
    "3. Fake Wallet System",
    "   3.1 Design & Animation",
    "   3.2 Two Variants (Approval + Signing)",
    "   3.3 Tutorial Tooltips",
    "   3.4 Toggle: Classic vs 1CT",
    "4. Fee Simulation \u2014 Every Fee with Exact Formulas",
    "   4.1 Position Fee (0.04% / 0.06%)",
    "   4.2 Borrow Fee (Per-Second Accrual)",
    "   4.3 Funding Rate (Adaptive Model)",
    "   4.4 Execution Fee (Keeper Gas)",
    "   4.5 Liquidation Fee (0.20% / 0.30%)",
    "   4.6 Fee Calculation Examples",
    "5. Price Execution Mechanics",
    "   5.1 Oracle Price Structure (Min/Max Spread)",
    "   5.2 Fill Price Determination by Direction",
    "   5.3 Acceptable Price & Slippage",
    "   5.4 Order Cancellation Simulation",
    "6. Keeper Delay Simulation",
    "   6.1 Timing (2-8 seconds, weighted)",
    "   6.2 Animation Design (4-step progress)",
    "   6.3 Cancel During Wait",
    "   6.4 Order Failure Simulation",
    "7. Liquidation Mechanics",
    "   7.1 Exact Liquidation Price Formula",
    "   7.2 Maintenance Margin per Market",
    "   7.3 Liquidation Process & Fee Deduction",
    "   7.4 Time-to-Liquidation Estimation",
    "   7.5 Liquidation Screen Design",
    "8. Position Engine \u2014 TypeScript Implementation",
    "   8.1 Core Types & Interfaces",
    "   8.2 PositionEngine Class Methods",
    "   8.3 P&L Calculation (Gross & After Fees)",
    "   8.4 Fee Accrual Logic",
    "   8.5 Liquidation Check Logic",
    "9. State Management (localStorage + Zustand)",
    "   9.1 Data Schema",
    "   9.2 Save/Load Strategy",
    "   9.3 Balance & Trade History",
    "   9.4 Reset & Top-Up Flows",
    "10. API Integration \u2014 Every Endpoint",
    "   10.1 GMX Oracle Keeper API",
    "   10.2 GMX API v1 (Market Info, Fees)",
    "   10.3 Binance WebSocket (Fallback)",
    "   10.4 Rate Limiting & Caching",
    "   10.5 Error Handling (Bad Data Protection)",
    "11. Tutorial System Design",
    "   11.1 Tutorial Mode vs Power User Mode",
    "   11.2 Tooltip Content for Every Step",
    "   11.3 Progressive Disclosure Strategy",
    "12. Settings & Configuration",
    "   12.1 Starting Balance Selection",
    "   12.2 Top-Up Flow",
    "   12.3 Reset Wallet",
    "   12.4 Toggle: Classic / 1CT Mode",
    "   12.5 Toggle: Tutorial On/Off",
    "   12.6 Toggle: Keeper Delay On/Off",
    "13. Edge Cases & Error Handling",
    "14. GMX V2 Contract Reference (Mainnet)",
    "15. GMX V2 Contract Reference (Arbitrum Sepolia Testnet)",
    "16. Implementation Phases",
]

for item in toc_items:
    indent = 20 if item.startswith("   ") else 0
    story.append(Paragraph(item.strip(), ParagraphStyle(
        "TOCItem", parent=styles["TOCEntry"], leftIndent=indent
    )))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 1: PRODUCT VISION
# ═══════════════════════════════════════════════════════════
story.append(h1("1. Product Vision & Core Promise"))
story.append(spacer(6))

story.append(p(
    "<b>EasyGMX Paper Trading</b> is a frontend-only simulation of GMX V2 perpetual futures trading. "
    "It allows anyone to experience GMX trading without a wallet, without crypto, and without risk. "
    "The simulation replicates every aspect of the real GMX trading experience: the same prices from the "
    "same oracle, the same fee structure (position fee, borrow fee, funding rate, execution fee, liquidation fee), "
    "the same keeper delay, the same wallet interaction flow, and the same liquidation mechanics. The only "
    "difference is that the money is fake."
))
story.append(p(
    "The target user is someone who is curious about decentralized perpetual futures trading but is not yet "
    "ready to risk real funds. This includes Web2 traders exploring DeFi for the first time, crypto holders "
    "who want to understand how GMX works before depositing, and anyone who Googles 'GMX paper trading' or "
    "'try GMX without money'. Currently, no one serves this audience. GMX itself has no paper trading mode, "
    "no public testnet UI, and no documentation for testnet usage. Hyperliquid has a testnet, but it is "
    "oriented toward developers, not curious traders. This is a real market gap."
))
story.append(p(
    "The core experience principle is: <b>if someone practices on EasyGMX Paper and then switches to real "
    "GMX, it should feel like the same app.</b> Every button, every fee, every wait, every number should "
    "match. The paper trading experience is not a simplified toy \u2014 it is a faithful simulation that "
    "teaches real DeFi trading mechanics. The fake wallet popups teach muscle memory for MetaMask. The keeper "
    "delay teaches patience. The fee breakdown teaches cost awareness. The liquidation teaches risk management."
))

story.append(h2("1.1 Key Differentiators"))
story.append(bullet("No wallet required \u2014 trade within 10 seconds of landing on the site"))
story.append(bullet("No signup, no account, no email \u2014 everything in localStorage"))
story.append(bullet("Real GMX oracle prices via the same API that app.gmx.io uses"))
story.append(bullet("Exact GMX V2 fee structure with dynamic rates from the API"))
story.append(bullet("Keeper delay simulation (2-8 seconds) matching real GMX execution"))
story.append(bullet("Fake wallet popups that mimic MetaMask for educational value"))
story.append(bullet("Two modes: Classic (full wallet flow) and One-Click Trading (gasless)"))
story.append(bullet("Tutorial system with progressive tooltips explaining every step"))
story.append(bullet("Liquidation simulation with real formula and time-to-liquidation"))
story.append(bullet("30-40% of paper traders convert to real traders (industry data)"))

story.append(h2("1.2 What This Is NOT"))
story.append(bullet("NOT a GMX clone \u2014 we copy the TRADING experience only, not earn/swap/governance pages"))
story.append(bullet("NOT a backtesting engine \u2014 we simulate live trading, not historical replay"))
story.append(bullet("NOT connected to any blockchain \u2014 purely frontend simulation"))
story.append(bullet("NOT a custodial service \u2014 no backend, no database, no user data stored"))
story.append(bullet("NOT financial advice \u2014 clear disclaimers that this is a simulation"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 2: USER FLOW
# ═══════════════════════════════════════════════════════════
story.append(h1("2. User Flow \u2014 Every Screen, Every Click"))
story.append(spacer(6))

story.append(p(
    "This section describes every screen the user encounters, every button they can click, and every state "
    "transition in the application. The flow is designed to mirror the real GMX V2 trading experience as closely "
    "as possible while adding educational elements that teach DeFi concepts to newcomers."
))

# 2.1 Landing
story.append(h2("2.1 Landing Page"))
story.append(p(
    "The landing page is the first thing a user sees. The design goal is: <b>trading within 10 seconds.</b> "
    "No wallet connection, no signup form, no cookie consent, no email verification. The user picks a starting "
    "balance and immediately enters the trading interface. The page should convey three things instantly: what "
    "this is (paper trading for GMX), why it is safe (fake money, no wallet), and what to do (pick a balance and start)."
))

story.append(h3("Layout (Top to Bottom)"))
story.append(bullet("Header: 'EasyGMX Paper Trading' branding with GMX V2 powered-by badge"))
story.append(bullet("Hero: 'Try GMX perps for free. Real prices. Real fees. Fake money.'"))
story.append(bullet("Balance selection: Three preset buttons [$10,000] [$100,000] [$1,000,000] plus custom input"))
story.append(bullet("Custom input field: Number input with 'USDC' label, min $1, max $10,000,000"))
story.append(bullet("Start button: 'Start Trading' \u2014 enabled when balance is selected, disabled otherwise"))
story.append(bullet("Feature grid: 3-column showing 'No Wallet Needed', 'Real GMX Prices', 'Exact Fee Simulation'"))
story.append(bullet("Footer: 'Switch to Real Trading' link to mainnet EasyGMX, disclaimer text"))

story.append(h3("Behavior Details"))
story.append(bullet("Clicking a preset button highlights it and enables 'Start Trading'"))
story.append(bullet("Custom input: validates numeric, min $1, formats with commas as user types"))
story.append(bullet("'Start Trading' creates a fake wallet in localStorage with the selected balance"))
story.append(bullet("On subsequent visits: if localStorage has a wallet, skip landing and go to market select"))
story.append(bullet("Small 'Reset & Start Over' link at bottom for returning users"))

story.append(h3("Tutorial Tooltip (First Visit Only)"))
story.append(note(
    "\u2139\ufe0f Welcome! This is a paper trading simulator for GMX V2. You'll trade with fake money "
    "but real market prices and fees. Nothing you do here involves real cryptocurrency. When you're ready "
    "for real trading, you can switch to mainnet mode."
))

# 2.2 Market Selection
story.append(h2("2.2 Market Selection Screen"))
story.append(p(
    "After choosing a starting balance, the user lands on the market selection screen. This screen shows the "
    "four supported perpetual futures markets with live oracle prices from the GMX API. The layout should match "
    "the feel of GMX's market selector but simplified \u2014 no search, no filter, just the four markets with "
    "essential information."
))

story.append(h3("Layout"))
story.append(bullet("Header: EasyGMX logo, fake USDC balance display, settings gear icon"))
story.append(bullet("Section title: 'Select a Market' with '4 Perpetual Futures' subtitle"))
story.append(bullet("Market cards: 4 rows, one per market, showing token icon, name, price, 24h change, open interest"))
story.append(bullet("Each card is clickable and navigates to the Trade Setup screen"))

story.append(h3("Market Card Contents"))
story.append(make_table(
    ["Element", "Source", "Format"],
    [
        ["Token icon", "Static asset", "SVG or emoji (\u27e2 ETH, \u20bf BTC, \u25ce SOL, \u25c6 ARB)"],
        ["Market name", "Static config", "ETH/USD, BTC/USD, SOL/USD, ARB/USD"],
        ["Oracle price", "GMX API /prices/tickers", "$X,XXX.XX (2 decimal for BTC/ETH, 4 for SOL/ARB)"],
        ["Price change", "Calculated from API", "+X.XX% green / -X.XX% red"],
        ["Open Interest", "GMX API /markets/info", "$XX.XM (longs + shorts)"],
        ["Borrow rate indicator", "GMX API borrowingFactor", "Low/Medium/High badge"],
        ["Funding rate", "GMX API fundingFactor", "+X.XX% (annualized) or '-'"],
    ],
    [2, 2, 3]
))

story.append(h3("Price Polling"))
story.append(p(
    "Prices are polled from the GMX Oracle Keeper API every 3 seconds. The API endpoint is "
    "<font face='Courier' size=8>GET https://arbitrum-api.gmxinfra.io/prices/tickers</font>. A local cache "
    "with 3-second TTL prevents redundant requests. If the API fails, stale cached prices are used with a "
    "'Prices may be stale' warning banner. The Binance WebSocket serves as a fallback for price data if the "
    "GMX API is unreachable for more than 30 seconds."
))

story.append(h3("Behavior Details"))
story.append(bullet("Fake USDC balance shown in header: '$10,000.00 USDC' (formatted with commas)"))
story.append(bullet("Settings gear icon opens settings panel (Section 12)"))
story.append(bullet("If user has an open position, the market card shows 'Position Active' badge"))
story.append(bullet("Market cards have hover effect: slight scale + border highlight"))
story.append(bullet("Clicking a market card navigates to Trade Setup with that market pre-selected"))

story.append(PageBreak())

# 2.3 Trade Setup
story.append(h2("2.3 Trade Setup Screen (Classic Mode)"))
story.append(p(
    "This is the core trading interface where users configure their trade. In Classic Mode, the flow "
    "replicates the full GMX V2 experience: select direction, enter amount, choose leverage, review fees, "
    "approve USDC (fake wallet popup), sign order (fake wallet popup), then wait for keeper. Every element "
    "mirrors the real GMX TradeBox component, including the fee breakdown and execution details."
))

story.append(h3("Layout (Top to Bottom)"))
story.append(bullet("Header: Back arrow, Market name + price, settings icon"))
story.append(bullet("Direction toggle: [Up / Long] [Down / Short] \u2014 green/red highlight"))
story.append(bullet("Amount section: Label 'Amount (USDC)', balance display, MAX button, preset buttons [$10 $25 $50 $100], custom input"))
story.append(bullet("Leverage section: [5x] [10x] [25x] [50x] \u2014 selected highlight, 25x+ shows risk badge"))
story.append(bullet("Summary card: Position size, estimated fees, liquidation price, borrow rate, max risk"))
story.append(bullet("Fee info toggle: 'i' button expands detailed fee breakdown"))
story.append(bullet("Submit button: Dynamic text based on state (see below)"))
story.append(bullet("Disclaimer: 'This is a simulation. Same prices & fees as GMX V2, no real risk.'"))

story.append(h3("Submit Button States (Classic Mode)"))
story.append(make_table(
    ["State", "Button Text", "Color", "Enabled"],
    [
        ["No amount", "Enter an amount", "Gray", "No"],
        ["Invalid amount", "Minimum trade is $1", "Gray", "No"],
        ["Insufficient balance", "Insufficient USDC balance", "Gray", "No"],
        ["Needs approval", "Approve USDC first", "Primary blue", "Yes"],
        ["Approving", "Approving USDC...", "Blue (loading)", "No"],
        ["Ready to trade", "Open Long \u2014 $500.00", "Green (long) / Red (short)", "Yes"],
        ["Signing", "Check wallet...", "Blue (loading)", "No"],
        ["Submitting", "Creating order...", "Blue (loading)", "No"],
        ["Keeper wait", "Waiting for keeper...", "Blue (loading)", "No"],
    ],
    [2, 2.5, 1.5, 1]
))

story.append(h3("Summary Card Contents"))
story.append(make_table(
    ["Row", "Value", "Source"],
    [
        ["Position size", "$X,XXX.XX", "amount x leverage"],
        ["Position fee", "$X.XX (0.04% or 0.06%)", "From API, depends on OI balance"],
        ["Borrow fee", "~$X.XX/hour", "From API borrowingFactorPerSecond"],
        ["Execution fee", "~$0.10 (ETH)", "Estimated from gas limit x gas price"],
        ["Gas fee (not charged)", "~$0.03 (ETH)", "Shown for education, NOT deducted"],
        ["Total cost (deducted)", "$X.XX", "Position fee only (execution shown but not charged)"],
        ["Max risk", "$X,XXX.XX", "Full collateral amount"],
        ["Liquidation price", "$X,XXX.XX", "Calculated from formula (Section 7)"],
        ["Acceptable price", "$X,XXX.XX", "Entry price +/- slippage (0.5% for open)"],
    ],
    [2, 2, 3]
))

story.append(h3("Fee Info Expansion (When 'i' is Clicked)"))
story.append(bullet("Position fee: 0.04% if trade balances pool, 0.06% if it imbalances pool. Determined by current long vs short OI."))
story.append(bullet("Borrow fee: Accrued continuously while position is open. Rate varies based on pool utilization (45-130% annualized). The smaller OI side pays ZERO borrow fee."))
story.append(bullet("Execution fee: Pays the keeper bot for gas. On real GMX, this is ~0.00003-0.0003 ETH. In paper trading, shown but NOT deducted from your balance."))
story.append(bullet("Funding rate: Longs pay shorts (or vice versa) based on OI imbalance. Annualized rate ranges from 1% to 90%. Accrued per-second."))
story.append(bullet("Slippage tolerance: 0.5% for market open orders, 3.0% for market close orders. If the oracle price at execution exceeds this, the order is cancelled."))
story.append(bullet("Liquidation fee: 0.20% (BTC/ETH) or 0.30% (SOL/ARB) of position size, charged only if liquidated."))

story.append(PageBreak())

# 2.4 Fake Wallet \u2014 Approval
story.append(h2("2.4 Fake Wallet Popup \u2014 Approval"))
story.append(p(
    "When the user clicks the trade button for the first time (or first time with a new token), the fake "
    "wallet popup appears simulating the MetaMask approval step. This teaches users that on real GMX, they "
    "must approve the SyntheticsRouter contract to spend their USDC. The popup slides up from the bottom of "
    "the screen, similar to MetaMask's mobile interface, and requires the user to click 'Approve' to proceed."
))

story.append(h3("Popup Layout"))
story.append(make_table(
    ["Element", "Content"],
    [
        ["Header", "EasyGMX Paper Wallet icon + 'Allow USDC to be spent?'"],
        ["Spender", "SyntheticsRouter: 0x7452c5...71f6 (truncated, expandable)"],
        ["Amount", "Unlimited (maxUint256) \u2014 matches real GMX behavior"],
        ["Info text", "This allows the trading contract to use your USDC for positions."],
        ["Reject button", "Gray, closes popup, returns to trade setup"],
        ["Approve button", "Blue, triggers 1-second 'Processing...' then 'Approved!'"],
        ["Tutorial tooltip", "On real GMX, this would open MetaMask. You'd sign a transaction approving USDC for trading. This approval is needed once per token."],
    ],
    [2, 5]
))

story.append(h3("Behavior"))
story.append(bullet("Popup animates in from bottom (300ms ease-out)"))
story.append(bullet("Clicking outside popup does NOT close it (prevents accidental dismissal)"))
story.append(bullet("'Approve' button shows spinner for 1 second (simulates tx confirmation)"))
story.append(bullet("After approval: green checkmark animation, popup closes after 500ms"))
story.append(bullet("Approval state is saved in localStorage \u2014 won't ask again for this token"))
story.append(bullet("If user clicks 'Reject': popup closes, button returns to 'Approve USDC first' state"))

# 2.5 Fake Wallet \u2014 Signing
story.append(h2("2.5 Fake Wallet Popup \u2014 Order Signing"))
story.append(p(
    "After approval (or on subsequent trades), clicking the trade button triggers the order signing popup. "
    "This simulates the MetaMask transaction signing step where the user reviews the order details and confirms. "
    "On real GMX, this is the ExchangeRouter.multicall transaction containing sendWnt + sendTokens + createOrder."
))

story.append(h3("Popup Layout"))
story.append(make_table(
    ["Element", "Content"],
    [
        ["Header", "EasyGMX Paper Wallet icon + 'Confirm Transaction'"],
        ["Order type", "Open Long (or Short) \u2014 MarketIncrease"],
        ["Market", "ETH/USD Perp"],
        ["Position size", "$500.00"],
        ["Collateral", "$100.00 USDC"],
        ["Leverage", "5x"],
        ["Execution fee", "~$0.10 (ETH) \u2014 on real GMX, this is real ETH"],
        ["Acceptable price", "$3,126.00 (entry + 0.5% slippage)"],
        ["Reject button", "Gray"],
        ["Confirm button", "Green (long) / Red (short)"],
        ["Tutorial tooltip", "On real GMX, MetaMask would show this transaction for you to sign. The multicall sends your USDC collateral + ETH for keeper gas + creates the order."],
    ],
    [2, 5]
))

story.append(h3("Behavior"))
story.append(bullet("Same slide-up animation as approval popup"))
story.append(bullet("'Confirm' triggers the keeper wait flow (Section 6)"))
story.append(bullet("If user clicks 'Reject': popup closes, no order created, back to trade setup"))

story.append(PageBreak())

# 2.6 Keeper Wait
story.append(h2("2.6 Keeper Wait Screen"))
story.append(p(
    "After the user confirms the order in the fake wallet popup, the keeper wait screen appears. This "
    "simulates the 2-8 second delay that occurs on real GMX while a keeper bot picks up the order, fetches "
    "fresh oracle prices, and executes the order on-chain. This delay is a fundamental part of the GMX V2 "
    "trading experience and must be faithfully simulated."
))

story.append(h3("Layout"))
story.append(bullet("Header: 'Processing Order' with spinning indicator"))
story.append(bullet("4-step progress indicator (each step lights up as it completes):"))
story.append(make_table(
    ["Step", "Label", "Duration", "Description"],
    [
        ["1", "Order submitted", "~0.5s", "Order data sent to the network"],
        ["2", "Oracle confirming price", "~1-3s", "Chainlink oracle provides fresh price"],
        ["3", "Keeper executing", "~1-3s", "Keeper bot submits execution transaction"],
        ["4", "Position opened", "Instant", "Order filled, position is live"],
    ],
    [0.5, 2, 1.5, 3]
))

story.append(h3("Animation Details"))
story.append(bullet("Each step shows a circle: gray (pending), pulsing blue (active), green checkmark (complete)"))
story.append(bullet("Connecting lines between steps animate as progress advances"))
story.append(bullet("Total wait time: randomized between 2-8 seconds, weighted toward 3-5 seconds"))
story.append(bullet("Weight distribution: 15% at 2s, 30% at 3s, 25% at 4s, 15% at 5s, 10% at 6s, 5% at 7s+"))
story.append(bullet("A small 'Cancel Order' button is visible during steps 1-2 (see Section 6.3)"))

story.append(h3("Fill Price Determination"))
story.append(p(
    "The fill price is determined at the END of the keeper wait, not when the user clicks. This matches "
    "real GMX where the oracle price at execution time determines the fill. The price used depends on direction:"
))
story.append(make_table(
    ["Action", "Price Used", "Reason"],
    [
        ["Open Long", "oraclePrice.max", "Worst price for buyer (you pay more)"],
        ["Open Short", "oraclePrice.min", "Worst price for buyer (you receive less)"],
        ["Close Long", "oraclePrice.min", "Worst price for seller (you receive less)"],
        ["Close Short", "oraclePrice.max", "Worst price for seller (you pay more)"],
    ],
    [2, 2, 3]
))
story.append(note(
    "\u2139\ufe0f GMX always uses the worse price for the trader from the oracle min/max spread. This is how "
    "real GMX works \u2014 the oracle provides a range, and the contract picks the price that is worst for you."
))

story.append(h3("Tutorial Tooltip"))
story.append(note(
    "\u2139\ufe0f On real GMX, a 'keeper' is an automated bot that executes your order. It waits for a fresh "
    "price from the Chainlink oracle, then submits a transaction to open your position. This typically takes "
    "2-8 seconds. Your order fills at the oracle price at execution time, which may differ slightly from the "
    "price you saw when you clicked."
))

# 2.7 Position Live
story.append(h2("2.7 Position Live Screen"))
story.append(p(
    "After the keeper wait completes, the position is live. This screen shows the open position with "
    "real-time P&L tracking, a live price chart, position details, and close buttons. The layout matches "
    "GMX's PositionItem component but adapted for our single-position focus."
))

story.append(h3("Layout (Top to Bottom)"))
story.append(bullet("Header: Market name, LONG/SHORT badge, confirmation status dot"))
story.append(bullet("Price chart: lightweight-charts AreaSeries, 3-second price updates, entry price line"))
story.append(bullet("Price row: Entry price | Current price (color-coded by P&L)"))
story.append(bullet("P&L hero: Large P&L in USD and percentage, color-coded green/red"))
story.append(bullet("Details section: Collateral, Position size, Liquidation price, Borrow fee (accrued), Funding rate, Net P&L"))
story.append(bullet("Close buttons: [Take Profit] (green) [Cut Loss] (red)"))
story.append(bullet("Links: Open tx (Arbiscan-style, simulated), Share P&L, Settings"))

story.append(h3("P&L Display"))
story.append(p(
    "P&L is calculated every 3 seconds when the price updates. Two modes are available via a toggle in settings:"
))
story.append(bullet("<b>Gross P&L</b>: (currentPrice - entryPrice) x direction x (sizeUsd / entryPrice)"))
story.append(bullet("<b>P&L after fees</b>: Gross P&L - accrued borrow fees - accrued funding fees - position fee (close)"))
story.append(p(
    "The toggle mirrors GMX's 'showPnlAfterFees' setting. Default is 'after fees' to teach users about "
    "the real cost of holding a position. Borrow fees accrue continuously and visibly reduce the P&L over time."
))

story.append(h3("Confirmation Status Dot"))
story.append(bullet("Yellow pulsing dot: 'Confirming...' (shown for 2-3 seconds after keeper fill, simulates on-chain confirmation)"))
story.append(bullet("Green steady dot: 'On-chain' (position confirmed)"))
story.append(note(
    "\u2139\ufe0f On real GMX, this dot indicates whether the position has been confirmed on the blockchain. "
    "The yellow state means the transaction is submitted but not yet finalized. On Arbitrum, finality takes ~1-2 seconds."
))

story.append(PageBreak())

# 2.8 Close Position
story.append(h2("2.8 Close Position Flow"))
story.append(p(
    "Closing a position follows the same flow as opening: fake wallet popup (signing only, no approval needed), "
    "keeper wait, then position closed. The close order type is MarketDecrease. On real GMX, closing uses a "
    "3% default slippage tolerance (vs 0.5% for opens) to reduce order cancellation rates."
))

story.append(h3("Close Flow Steps"))
story.append(make_table(
    ["Step", "Duration", "What Happens"],
    [
        ["1. Click 'Take Profit' or 'Cut Loss'", "Instant", "Button changes to 'Submitting...'"],
        ["2. Fake wallet popup (signing)", "User action", "Shows close order details, user clicks Confirm"],
        ["3. Keeper wait", "2-8 seconds", "Same 4-step animation as opening"],
        ["4. Fill at oracle price", "Instant", "Close Long: oraclePrice.min, Close Short: oraclePrice.max"],
        ["5. P&L result card", "Until dismissed", "Shows final P&L, fees, duration"],
    ],
    [2.5, 1.5, 3]
))

story.append(h3("Close Order Details in Fake Wallet"))
story.append(make_table(
    ["Field", "Value"],
    [
        ["Order type", "MarketDecrease"],
        ["Position", "Close Long ETH/USD 5x"],
        ["Position size", "$500.00"],
        ["Estimated P&L", "+$20.58 (4.12%)"],
        ["Close fee", "$0.30 (0.06% of size)"],
        ["Execution fee", "~$0.10 (ETH) \u2014 not charged in paper mode"],
        ["Acceptable price", "$3,110.00 (current - 3% slippage for long close)"],
        ["Receive (estimated)", "$120.28 USDC (collateral + P&L - fees)"],
    ],
    [2, 5]
))

# 2.9 P&L Result
story.append(h2("2.9 P&L Result Card"))
story.append(p(
    "After a position is closed, the P&L result card appears. This shows the complete trade summary including "
    "all fees paid. The card can be shared (copy to clipboard) or dismissed to start a new trade."
))

story.append(h3("Card Contents"))
story.append(make_table(
    ["Element", "Example", "Notes"],
    [
        ["Direction + Market", "5x Long ETH/USD", "Leverage, direction, market"],
        ["P&L (large)", "+$20.58", "Green if positive, red if negative"],
        ["P&L percentage", "+4.12%", "Relative to collateral"],
        ["Entry price", "$3,142.50", "Actual fill price from oracle"],
        ["Exit price", "$3,168.30", "Actual close fill price from oracle"],
        ["Position fee (open)", "-$0.30", "0.06% of $500"],
        ["Position fee (close)", "-$0.30", "0.06% of $500"],
        ["Borrow fee (total)", "-$0.12", "Accrued over duration"],
        ["Funding fee (total)", "-$0.03", "Net funding paid/received"],
        ["Execution fee (shown)", "~$0.20 (not charged)", "Keeper gas, shown for education"],
        ["Net P&L", "+$19.83", "After all fees"],
        ["Duration", "2h 14m", "Time position was open"],
        ["Status badge", "SIMULATION", "Reminds user this is paper trading"],
    ],
    [2.5, 2, 2.5]
))

story.append(PageBreak())

# 2.10 One-Click Trading
story.append(h2("2.10 One-Click Trading (1CT) Mode"))
story.append(p(
    "GMX V2 offers One-Click Trading (also called Express Mode or 1CT) via Gelato Relay. In this mode, "
    "users set up a subaccount once, and then every trade is submitted without a wallet popup \u2014 just "
    "click and the order goes through. Gas is paid in USDC instead of ETH. This is a dramatically simpler "
    "experience and is increasingly the default for experienced GMX users. We simulate this in paper trading "
    "to teach users about both modes."
))

story.append(h3("1CT Setup Flow"))
story.append(make_table(
    ["Step", "What User Sees", "What Happens"],
    [
        ["1", "Settings: 'Enable One-Click Trading' toggle", "User clicks toggle"],
        ["2", "Setup modal: 'Set up gasless trading'", "Explains 1CT: no wallet popups, gas paid in USDC, 90 actions, 7 day expiry"],
        ["3", "Fake wallet popup: 'Sign setup message'", "Simulates the EIP-712 signature for subaccount creation"],
        ["4", "Processing animation (2 seconds)", "Simulates on-chain subaccount activation"],
        ["5", "Success: 'One-Click Trading activated!'", "Counter shows '90/90 actions remaining', 'Expires in 7 days'"],
    ],
    [0.5, 3, 3.5]
))

story.append(h3("1CT Trading Flow (After Setup)"))
story.append(make_table(
    ["Step", "Classic Mode", "1CT Mode"],
    [
        ["Click 'Open Long'", "Button: 'Approve USDC first'", "Button: 'Open Long \u26a1' (with gasless badge)"],
        ["Approval popup", "Fake wallet: approve USDC", "SKIPPED"],
        ["Signing popup", "Fake wallet: sign transaction", "SKIPPED"],
        ["Order submission", "After user confirms in wallet", "Instant (no user action needed)"],
        ["Keeper wait", "2-8 seconds", "2-8 seconds (same)"],
        ["Position opened", "Same", "Same"],
    ],
    [2, 2.5, 2.5]
))

story.append(h3("1CT Session Management"))
story.append(bullet("Action counter: Starts at 90, decrements with each order (open, close, cancel)"))
story.append(bullet("Expiry timer: 7 days from activation, shown in settings"))
story.append(bullet("When counter reaches 10: Warning banner '10/90 actions remaining. Renew soon?'"))
story.append(bullet("When counter reaches 0 or timer expires: '1CT session expired. Renew?' modal"))
story.append(bullet("Renewal: Same setup flow, resets counter to 90 and timer to 7 days"))
story.append(bullet("User can disable 1CT anytime in settings, reverting to Classic Mode"))
story.append(note(
    "\u2139\ufe0f On real GMX, 1CT uses a subaccount derived from your wallet signature. The subaccount "
    "has limited permissions: it can create and cancel orders but CANNOT withdraw funds. It auto-expires "
    "after 7 days for security. Gas is paid in USDC via Gelato Relay instead of ETH."
))

story.append(h3("When to Promote 1CT"))
story.append(p(
    "After the user completes 3 trades in Classic Mode, a subtle banner appears: 'Tired of confirming every "
    "trade? Try One-Click Trading \u2192'. This mirrors how real GMX promotes 1CT after users have traded a "
    "few times. The user can dismiss the banner or click to enable 1CT."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 3: FAKE WALLET SYSTEM
# ═══════════════════════════════════════════════════════════
story.append(h1("3. Fake Wallet System"))
story.append(spacer(6))

story.append(p(
    "The fake wallet is the key educational component of EasyGMX Paper Trading. It simulates the MetaMask "
    "wallet interaction flow that users would experience on real GMX, teaching the muscle memory of reviewing "
    "and confirming transactions. The wallet popup should feel familiar to anyone who has used MetaMask while "
    "being clearly labeled as a simulation."
))

story.append(h2("3.1 Design & Animation"))
story.append(bullet("Position: Slides up from bottom of screen, covering ~40% of viewport height"))
story.append(bullet("Animation: 300ms ease-out slide, with slight bounce on arrival"))
story.append(bullet("Backdrop: Semi-transparent black overlay (60% opacity) behind popup"))
story.append(bullet("Clicking backdrop: Does NOT close popup (prevents accidental dismissal)"))
story.append(bullet("Close: Only via 'Reject' button or 'Approve/Confirm' button"))
story.append(bullet("Shape: Rounded top corners (16px radius), white background, subtle shadow"))
story.append(bullet("Header: Lock icon + 'EasyGMX Paper Wallet' + 'SIMULATION' badge"))
story.append(bullet("The 'SIMULATION' badge is always visible but small (8px font, gray)"))

story.append(h2("3.2 Two Variants"))

story.append(h3("Variant A: Approval Popup"))
story.append(p("Appears when: User is trading with a token for the first time (USDC approval needed)."))
story.append(make_table(
    ["UI Element", "Content", "Purpose"],
    [
        ["Title", "Allow USDC to be spent?", "Mimics MetaMask approve prompt"],
        ["Spender address", "SyntheticsRouter: 0x7452c5...71f6", "Educational: shows what contract gets access"],
        ["Approval amount", "Unlimited", "Matches real GMX (maxUint256 approval)"],
        ["Explanation", "This allows the trading contract to use your USDC for positions.", "Teaches why approval is needed"],
        ["Reject button", "Gray, 'Reject'", "Safe exit"],
        ["Approve button", "Blue, 'Approve'", "Triggers 1-second processing animation"],
    ],
    [2, 2.5, 2.5]
))

story.append(h3("Variant B: Order Signing Popup"))
story.append(p("Appears when: User is submitting an order (after approval, or on subsequent trades)."))
story.append(make_table(
    ["UI Element", "Content (Open Long Example)", "Purpose"],
    [
        ["Title", "Confirm Transaction", "Mimics MetaMask tx signing"],
        ["Order type", "Open Long \u2014 MarketIncrease", "Educational: shows order type enum"],
        ["Market", "ETH/USD Perp", "Confirms market"],
        ["Position size", "$500.00", "Confirms position size"],
        ["Collateral", "$100.00 USDC", "Confirms collateral amount"],
        ["Leverage", "5x", "Confirms leverage"],
        ["Execution fee", "~$0.10 (ETH)", "Educational: shows keeper gas cost"],
        ["Acceptable price", "$3,126.00 (+0.5%)", "Educational: shows slippage limit"],
        ["Reject button", "Gray, 'Reject'", "Safe exit"],
        ["Confirm button", "Green/Red (direction), 'Confirm'", "Triggers keeper wait"],
    ],
    [2, 2.5, 2.5]
))

story.append(h2("3.3 Tutorial Tooltips"))
story.append(p(
    "When Tutorial Mode is ON (default), each fake wallet popup includes an info tooltip below the buttons. "
    "These tooltips explain what would happen on real GMX:"
))
story.append(make_table(
    ["Popup", "Tooltip Text"],
    [
        ["Approval", "On real GMX, this would open MetaMask. You'd sign a transaction approving the SyntheticsRouter contract to spend your USDC. This is needed once per token. The approval is unlimited so you don't need to approve again."],
        ["Order signing", "On real GMX, MetaMask would show this transaction for you to sign. It's a 'multicall' that does three things: 1) Sends your USDC collateral to the order vault, 2) Sends ETH for the keeper's gas, 3) Creates the order. The keeper will execute it in 2-8 seconds."],
        ["Close signing", "On real GMX, this signs the close order. No new approval is needed because you're not depositing new tokens. The keeper will close your position at the current oracle price."],
    ],
    [1.5, 5.5]
))

story.append(h2("3.4 Toggle: Classic vs 1CT"))
story.append(p(
    "In settings, users can switch between Classic Mode (full wallet popups) and One-Click Trading Mode "
    "(no wallet popups). When 1CT is active, the fake wallet popup is skipped entirely \u2014 clicking the "
    "trade button goes straight to the keeper wait. A small '\u26a1 Gasless' badge appears on the trade button. "
    "See Section 2.10 for full 1CT details."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 4: FEE SIMULATION
# ═══════════════════════════════════════════════════════════
story.append(h1("4. Fee Simulation \u2014 Every Fee with Exact Formulas"))
story.append(spacer(6))

story.append(p(
    "This is the most critical section of the specification. Every fee in EasyGMX Paper Trading must match "
    "GMX V2 exactly. Fees are read dynamically from the GMX API where possible, with hardcoded fallbacks. "
    "All fee calculations use 30-decimal precision (FLOAT_PRECISION = 10^30) to match GMX's on-chain math."
))

# 4.1 Position Fee
story.append(h2("4.1 Position Fee"))
story.append(p(
    "The position fee is charged on BOTH opening and closing a position. The rate depends on whether the trade "
    "improves or worsens the pool's long/short balance. This is NOT a flat fee \u2014 it varies based on the "
    "current state of open interest at the time of the trade."
))

story.append(h3("Rate Determination"))
story.append(make_table(
    ["Condition", "Rate", "Explanation"],
    [
        ["Trade balances the pool (positive impact)", "0.04% of position size (sizeDeltaUsd)", "Your trade reduces the long/short imbalance"],
        ["Trade imbalances the pool (negative impact)", "0.06% of position size (sizeDeltaUsd)", "Your trade increases the long/short imbalance"],
    ],
    [2.5, 2, 2.5]
))

story.append(h3("How to Determine Positive vs Negative Impact"))
story.append(p(
    "The impact depends on the current long vs short open interest and the direction of the trade. The API "
    "provides the current OI for each side. The logic is:"
))
story.append(formula(
    "If opening LONG and longOI > shortOI: NEGATIVE impact (0.06%) \u2014 you're making imbalance worse<br/>"
    "If opening LONG and longOI < shortOI: POSITIVE impact (0.04%) \u2014 you're helping balance<br/>"
    "If opening SHORT and shortOI > longOI: NEGATIVE impact (0.06%) \u2014 you're making imbalance worse<br/>"
    "If opening SHORT and shortOI < longOI: POSITIVE impact (0.04%) \u2014 you're helping balance<br/>"
    "Same logic applies for closing positions (closing a long is like going short)."
))

story.append(h3("Formula"))
story.append(formula(
    "positionFeeUsd = sizeDeltaUsd * feeFactor / FLOAT_PRECISION<br/>"
    "where feeFactor = 0.0004 (positive) or 0.0006 (negative) in 30-decimal precision<br/>"
    "FLOAT_PRECISION = 10^30"
))

story.append(h3("Source"))
story.append(p(
    "The fee factor is available from the GMX API at <font face='Courier' size=8>GET /markets/info</font> "
    "in the fields <font face='Courier' size=8>positionFeeFactorForBalanceWasImproved</font> and "
    "<font face='Courier' size=8>positionFeeFactorForBalanceWasNotImproved</font>. Alternatively, it can be "
    "read from the DataStore contract using the key "
    "<font face='Courier' size=8>keccak256(abi.encode('POSITION_FEE_FACTOR', market, bool))</font>."
))

# 4.2 Borrow Fee
story.append(h2("4.2 Borrow Fee (Per-Second Accrual)"))
story.append(p(
    "Borrow fees accrue continuously while a position is open. The rate follows a kinked model similar to "
    "Aave/Compound, with two regimes based on pool utilization. Critically, the smaller OI side pays ZERO "
    "borrow fee \u2014 this is unique to GMX V2 and must be accurately simulated."
))

story.append(h3("Kinked Rate Model"))
story.append(formula(
    "usageFactor = reservedUsd / maxReservedUsd (adjusted by openInterestReserveFactor)<br/><br/>"
    "If usageFactor <= optimalUsageFactor:<br/>"
    "&nbsp;&nbsp;borrowingFactorPerSecond = usageFactor * baseBorrowingFactor<br/><br/>"
    "If usageFactor > optimalUsageFactor:<br/>"
    "&nbsp;&nbsp;borrowingFactorPerSecond = usageFactor * baseBorrowingFactor<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;+ (usageFactor - optimalUsageFactor) / (1 - optimalUsageFactor)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;* (aboveOptimalBorrowingFactor - baseBorrowingFactor)"
))

story.append(h3("Production Config (Arbitrum)"))
story.append(make_table(
    ["Market", "Base Rate (year)", "Above-Optimal Rate (year)", "Optimal Usage"],
    [
        ["ETH (WETH-USDC)", "45%", "90%", "85%"],
        ["BTC (WBTC-USDC)", "45%", "90%", "85%"],
        ["ETH (WETH-WETH)", "50%", "130%", "75%"],
        ["BTC (WBTC-WBTC)", "50%", "130%", "75%"],
        ["SOL, ARB, etc.", "55%", "130%", "75%"],
    ],
    [2, 1.5, 2, 1.5]
))

story.append(h3("Critical: Skip Borrowing Fee for Smaller Side"))
story.append(p(
    "On Arbitrum, <font face='Courier' size=8>skipBorrowingFeeForSmallerSide = true</font>. This means: if "
    "long OI is less than short OI, longs pay NO borrow fee. If short OI is less than long OI, shorts pay "
    "NO borrow fee. This must be checked every time we calculate borrow fees, as OI changes over time."
))

story.append(h3("Cumulative Accrual Model"))
story.append(formula(
    "Per-second accrual:<br/>"
    "durationInSeconds = timeSinceLastUpdate<br/>"
    "delta = durationInSeconds * borrowingFactorPerSecond<br/>"
    "nextCumulativeBorrowingFactor = cumulativeBorrowingFactor + delta<br/><br/>"
    "Fee for a position:<br/>"
    "diffFactor = currentCumulativeBorrowingFactor - position.borrowingFactorAtOpen<br/>"
    "borrowingFeeUsd = position.sizeInUsd * diffFactor / FLOAT_PRECISION"
))

story.append(h3("Implementation in Paper Trading"))
story.append(p(
    "We read <font face='Courier' size=8>borrowingFactorPerSecondForLongs</font> and "
    "<font face='Courier' size=8>borrowingFactorPerSecondForShorts</font> from the GMX API every 3 seconds "
    "along with price updates. The cumulative factor is maintained locally. Every price update tick also "
    "accrues borrow fee to the position's P&L."
))

# 4.3 Funding Rate
story.append(h2("4.3 Funding Rate (Adaptive Model)"))
story.append(p(
    "GMX V2 uses an adaptive funding rate model where the rate ramps up when OI is imbalanced and decays "
    "when it rebalances. The larger OI side pays the smaller side. Funding accrues per-second like borrow fees."
))

story.append(h3("Rate Config (Arbitrum)"))
story.append(make_table(
    ["Config", "Max Annual Rate", "Ramp-Up Time", "Decay Time", "Stable Threshold"],
    [
        ["Low (BTC, ETH)", "75%", "3 hours", "48 hours", "4%"],
        ["Default (SOL, ARB)", "90%", "3 hours", "48 hours", "4%"],
    ],
    [2, 1.5, 1.5, 1.5, 1.5]
))

story.append(h3("Who Pays Whom"))
story.append(bullet("If longOI > shortOI: Longs pay Shorts (longsPayShorts = true)"))
story.append(bullet("If shortOI > longOI: Shorts pay Longs (longsPayShorts = false)"))
story.append(bullet("Minimum rate: 1% per year (never zero while imbalance exists)"))

story.append(h3("Per-Position Funding Fee"))
story.append(formula(
    "fundingFactorPerPeriod = fundingFactorPerSecond * durationInSeconds<br/>"
    "fundingFeeUsd = position.sizeInUsd * fundingFactorPerPeriod / FLOAT_PRECISION<br/><br/>"
    "If your side is paying: fundingFeeUsd is negative (deducted from P&L)<br/>"
    "If your side is receiving: fundingFeeUsd is positive (added to P&L)"
))

story.append(h3("Source"))
story.append(p(
    "Funding rates are available from the GMX API at <font face='Courier' size=8>GET /markets/info</font> "
    "in the fields <font face='Courier' size=8>fundingFactorPerSecond</font> and "
    "<font face='Courier' size=8>longsPayShorts</font>."
))

story.append(PageBreak())

# 4.4 Execution Fee
story.append(h2("4.4 Execution Fee (Keeper Gas)"))
story.append(p(
    "The execution fee pays the keeper bot for gas costs. On real GMX, the user provides this fee upfront "
    "in ETH when creating the order. In paper trading, we SHOW this fee for educational purposes but do NOT "
    "deduct it from the fake USDC balance (since it would be paid in ETH, not USDC, on real GMX)."
))

story.append(h3("Calculation"))
story.append(formula(
    "baseGasLimit = estimatedGasFeeBaseAmount + (estimatedGasFeePerOraclePrice * oraclePriceCount)<br/>"
    "gasLimit = baseGasLimit + estimatedGasLimit * multiplierFactor<br/>"
    "executionFeeWei = gasLimit * gasPrice<br/>"
    "executionFeeUsd = convertToUsd(executionFeeWei, nativeTokenDecimals, nativeTokenPrice)"
))

story.append(h3("Gas Limits (Arbitrum)"))
story.append(make_table(
    ["Order Type", "Gas Limit"],
    [
        ["Increase (open position)", "3,000,000 gas"],
        ["Decrease (close position)", "3,000,000 gas"],
        ["Swap", "2,500,000 gas"],
    ],
    [3, 4]
))

story.append(h3("Typical Costs"))
story.append(make_table(
    ["Scenario", "Gas Price", "ETH Cost", "USD Cost"],
    [
        ["Quiet period", "0.01 gwei", "~0.00003 ETH", "$0.05-$0.10"],
        ["Normal", "0.05 gwei", "~0.00015 ETH", "$0.25-$0.50"],
        ["Busy period", "0.1 gwei", "~0.0003 ETH", "$0.50-$1.00"],
    ],
    [2, 1.5, 1.5, 2]
))

story.append(h3("Paper Trading Handling"))
story.append(bullet("Show execution fee in the trade summary as '~$0.10 (ETH) \u2014 not charged in paper mode'"))
story.append(bullet("Show in the fake wallet popup as 'Execution fee: ~$0.10 (ETH)'"))
story.append(bullet("Do NOT deduct from fake USDC balance"))
story.append(bullet("Explain in tutorial tooltip: 'On real GMX, this fee is paid in ETH from your wallet. It covers the gas cost for the keeper bot to execute your order.'"))

# 4.5 Liquidation Fee
story.append(h2("4.5 Liquidation Fee"))
story.append(make_table(
    ["Market Type", "Rate", "Example ($500 position)"],
    [
        ["BTC, ETH (USDC collateral)", "0.20% of position size", "$1.00"],
        ["SOL, ARB (synthetic)", "0.30% of position size", "$1.50"],
    ],
    [3, 2, 2]
))
story.append(p(
    "The liquidation fee is an ADDITIONAL fee charged when a position is liquidated, on top of the normal "
    "close position fee. It is deducted from the remaining collateral. Any collateral remaining after all fees "
    "goes to the LP pool \u2014 the trader loses everything. This must be clearly communicated in the "
    "liquidation screen."
))

# 4.6 Fee Examples
story.append(h2("4.6 Fee Calculation Examples"))

story.append(h3("Example 1: Open $500 Long ETH with 5x leverage ($100 collateral)"))
story.append(make_table(
    ["Fee Type", "Calculation", "Amount", "Deducted?"],
    [
        ["Position fee (open)", "0.06% x $500 (negative impact assumed)", "$0.30", "Yes, from USDC balance"],
        ["Execution fee", "~3M gas x 0.05 gwei", "~$0.25", "Shown, NOT deducted"],
        ["Borrow fee (starts at)", "45%/yr x $500 / 8760hrs", "~$0.03/hour", "Accrued continuously"],
        ["Funding (if longs > shorts)", "Varies, e.g. 10%/yr x $500 / 8760hrs", "~$0.006/hour", "Accrued continuously"],
    ],
    [2, 2.5, 1.5, 1]
))

story.append(h3("Example 2: Close $500 Long ETH after 2 hours (P&L = +$20.58)"))
story.append(make_table(
    ["Fee Type", "Calculation", "Amount", "Deducted From"],
    [
        ["Position fee (close)", "0.06% x $500", "$0.30", "P&L at close"],
        ["Borrow fee (2 hours)", "~$0.03/hr x 2", "$0.06", "P&L continuously"],
        ["Funding (2 hours)", "~$0.006/hr x 2", "$0.012", "P&L continuously"],
        ["Execution fee (close)", "~$0.25", "Shown only", "NOT deducted"],
        ["Total fees paid", "$0.30 + $0.06 + $0.012 + $0.30 (open)", "$0.672", "From P&L + balance"],
        ["Net P&L", "$20.58 - $0.672", "$19.91", "Added to balance"],
    ],
    [2, 2.5, 1.5, 1]
))

story.append(h3("Example 3: Liquidation of $500 Long ETH (collateral $100)"))
story.append(make_table(
    ["Deduction", "Amount", "Running Total"],
    [
        ["Starting collateral", "$100.00", "$100.00"],
        ["Position fee (close, 0.06%)", "-$0.30", "$99.70"],
        ["Borrow fee (accumulated)", "-$0.50", "$99.20"],
        ["Funding fee (accumulated)", "-$0.10", "$99.10"],
        ["Liquidation fee (0.20%)", "-$1.00", "$98.10"],
        ["Remaining to LP pool", "-$98.10", "$0.00"],
        ["Trader receives", "$0.00", "Total loss: $100"],
    ],
    [3, 2, 2]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 5: PRICE EXECUTION
# ═══════════════════════════════════════════════════════════
story.append(h1("5. Price Execution Mechanics"))
story.append(spacer(6))

story.append(h2("5.1 Oracle Price Structure (Min/Max Spread)"))
story.append(p(
    "The GMX V2 oracle provides prices with a min/max spread, not a single price. The spread represents "
    "the bid/ask range. All price-dependent calculations use either min or max depending on the action, "
    "always choosing the worse price for the trader."
))
story.append(formula(
    "Price = { min, max }<br/>"
    "midPrice = (min + max) / 2<br/>"
    "spread = max - min (typically 0.01-0.1% depending on market)"
))

story.append(h2("5.2 Fill Price Determination by Direction"))
story.append(make_table(
    ["Action", "Price Used", "Why", "Effect on Trader"],
    [
        ["Open Long", "indexTokenPrice.max", "Worst for buyer", "Pays more per token"],
        ["Open Short", "indexTokenPrice.min", "Worst for buyer", "Receives less per token"],
        ["Close Long", "indexTokenPrice.min", "Worst for seller", "Receives less per token"],
        ["Close Short", "indexTokenPrice.max", "Worst for seller", "Pays more per token"],
        ["P&L Calculation", "midPrice or pickPriceForPnl", "Fair value", "Neutral"],
        ["Funding", "midPrice", "Fair value", "Neutral"],
        ["Borrowing", "midPrice", "Fair value", "Neutral"],
    ],
    [2, 2, 1.5, 1.5]
))

story.append(h2("5.3 Acceptable Price & Slippage"))
story.append(p(
    "When creating an order, the user specifies an 'acceptablePrice' which acts as a slippage limit. If the "
    "oracle price at execution time is worse than the acceptable price, the order is CANCELLED (not filled at "
    "a bad price). This is a safety mechanism."
))
story.append(formula(
    "For Open Long: acceptablePrice = currentPrice * (1 + slippageTolerance)<br/>"
    "For Open Short: acceptablePrice = currentPrice * (1 - slippageTolerance)<br/>"
    "For Close Long: acceptablePrice = currentPrice * (1 - slippageTolerance)<br/>"
    "For Close Short: acceptablePrice = currentPrice * (1 + slippageTolerance)<br/><br/>"
    "Default slippage: 0.5% for open orders, 3.0% for close orders"
))

story.append(h2("5.4 Order Cancellation Simulation"))
story.append(p(
    "In paper trading, we simulate order cancellations when the price moves beyond the acceptable price during "
    "the keeper wait. This happens on real GMX approximately 5-10% of the time on volatile markets."
))
story.append(bullet("During keeper wait (2-8 seconds), we check if the current oracle price exceeds acceptablePrice"))
story.append(bullet("If exceeded: Order is cancelled, collateral returned to balance, toast notification: 'Order cancelled \u2014 price moved beyond acceptable range'"))
story.append(bullet("Cancellation probability in simulation: based on actual price movement during wait, not random"))
story.append(bullet("On volatile markets (price moving >0.3% in 5 seconds), cancellations will naturally occur more often"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 6: KEEPER DELAY
# ═══════════════════════════════════════════════════════════
story.append(h1("6. Keeper Delay Simulation"))
story.append(spacer(6))

story.append(h2("6.1 Timing"))
story.append(p(
    "The keeper delay is the time between order submission and order execution. On real GMX, this is typically "
    "1-5 seconds but can be up to 30 seconds. We simulate this with a weighted random distribution:"
))
story.append(make_table(
    ["Delay", "Probability", "Rationale"],
    [
        ["2 seconds", "15%", "Fast keeper, low congestion"],
        ["3 seconds", "30%", "Most common on Arbitrum"],
        ["4 seconds", "25%", "Normal operation"],
        ["5 seconds", "15%", "Slight congestion"],
        ["6 seconds", "10%", "Busy period"],
        ["7+ seconds", "5%", "High congestion or oracle delay"],
    ],
    [2, 1.5, 3.5]
))

story.append(h2("6.2 Animation Design (4-Step Progress)"))
story.append(p(
    "The keeper wait screen shows a 4-step progress indicator. Each step has three visual states: "
    "pending (gray circle), active (pulsing blue), complete (green checkmark). Steps are connected by "
    "lines that animate as progress advances."
))
story.append(make_table(
    ["Step", "Label", "Min Duration", "Max Duration", "What It Simulates"],
    [
        ["1", "Order submitted", "0.3s", "0.8s", "Transaction confirmed on Arbitrum"],
        ["2", "Oracle confirming price", "0.5s", "2.5s", "Chainlink oracle provides signed price"],
        ["3", "Keeper executing", "0.5s", "3.0s", "Keeper bot submits executeOrder tx"],
        ["4", "Position opened", "0.1s", "0.3s", "Order filled, position created"],
    ],
    [0.5, 2, 1, 1, 2.5]
))

story.append(h2("6.3 Cancel During Wait"))
story.append(p(
    "A 'Cancel Order' button is visible during steps 1-2. Clicking it:"))
story.append(bullet("Immediately cancels the pending order"))
story.append(bullet("Returns collateral to fake USDC balance"))
story.append(bullet("Shows toast: 'Order cancelled'"))
story.append(bullet("Position fee is NOT charged (order was never executed)"))
story.append(note(
    "\u2139\ufe0f On real GMX, cancelling races with the keeper. If the keeper hasn't executed yet, the "
    "cancel succeeds. If the keeper already executed, the cancel reverts harmlessly. In paper trading, "
    "cancelling always succeeds during steps 1-2 and fails during steps 3-4 (keeper is already executing)."
))

story.append(h2("6.4 Order Failure Simulation"))
story.append(p(
    "Orders can fail on real GMX if the oracle price at execution exceeds the acceptable price. In paper "
    "trading, we check this naturally: if the real oracle price at the end of the keeper wait exceeds the "
    "acceptable price, the order is cancelled automatically. This happens most often on volatile markets and "
    "teaches users about slippage and the importance of setting appropriate slippage tolerance."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 7: LIQUIDATION
# ═══════════════════════════════════════════════════════════
story.append(h1("7. Liquidation Mechanics"))
story.append(spacer(6))

story.append(h2("7.1 Exact Liquidation Price Formula"))
story.append(p(
    "A position is liquidatable when its remaining collateral falls below the minimum collateral requirement. "
    "The formula differs for longs and shorts."
))

story.append(h3("For Long Positions"))
story.append(formula(
    "remainingCollateralUsd = collateralAmount * collateralPrice<br/>"
    "&nbsp;&nbsp;+ (sizeInTokens * markPrice - sizeInUsd) &nbsp;&nbsp;// P&L for long<br/>"
    "&nbsp;&nbsp;+ priceImpactUsd &nbsp;&nbsp;// capped to 0 if positive<br/>"
    "&nbsp;&nbsp;- totalCostAmount * collateralPrice &nbsp;&nbsp;// fees<br/><br/>"
    "Liquidation when: remainingCollateralUsd &lt; sizeInUsd * minCollateralFactor<br/><br/>"
    "Solving for P_liquidation:<br/>"
    "P_liquidation = [sizeInUsd - collateralAmount * collateralPrice - priceImpactUsd<br/>"
    "&nbsp;&nbsp;+ costs + sizeInUsd * minCollateralFactor] / sizeInTokens"
))

story.append(h3("For Short Positions"))
story.append(formula(
    "P&L for short = sizeInUsd - (sizeInTokens * markPrice)<br/><br/>"
    "P_liquidation = [collateralAmount * collateralPrice + priceImpactUsd - costs<br/>"
    "&nbsp;&nbsp;+ sizeInUsd - sizeInUsd * minCollateralFactor] / sizeInTokens"
))

story.append(h2("7.2 Maintenance Margin per Market"))
story.append(make_table(
    ["Market", "minCollateralFactor", "Max Leverage", "Liquidation Fee"],
    [
        ["ETH/USD (WETH-USDC)", "0.5%", "200x", "0.20%"],
        ["BTC/USD (WBTC-USDC)", "0.5%", "200x", "0.20%"],
        ["SOL/USD (synthetic)", "1.0%", "100x", "0.30%"],
        ["ARB/USD (synthetic)", "1.0%", "100x", "0.30%"],
    ],
    [2, 1.5, 1.5, 1]
))

story.append(note(
    "\u2139\ufe0f The minCollateralFactor can increase dynamically as open interest grows. For BTC/ETH, "
    "the factor increases by 6e-11 per dollar of OI. At ~$83M OI, the factor doubles from 0.5% to 1.0%. "
    "For paper trading, we use the base values and can add dynamic scaling later."
))

story.append(h2("7.3 Liquidation Process & Fee Deduction"))
story.append(p("When a position is liquidated, the following deductions occur in order:"))
story.append(make_table(
    ["Order", "Deduction", "Example ($500 position, $100 collateral)"],
    [
        ["1", "Close position fee (0.06%)", "-$0.30"],
        ["2", "Accumulated borrow fees", "-$0.50 (varies)"],
        ["3", "Funding fee settlement", "-$0.10 (varies)"],
        ["4", "Liquidation fee (0.20-0.30%)", "-$1.00"],
        ["5", "Remaining collateral to LP pool", "-$98.10"],
        ["", "Trader receives", "$0.00"],
    ],
    [0.5, 3, 3.5]
))

story.append(h2("7.4 Time-to-Liquidation Estimation"))
story.append(p(
    "GMX shows an estimated time-to-liquidation based on the current borrow fee rate and the distance "
    "to the liquidation price. The formula considers that borrow fees continuously erode collateral:"
))
story.append(formula(
    "hoursToLiquidation = (remainingCollateralUsd - sizeInUsd * minCollateralFactor)<br/>"
    "&nbsp;&nbsp;/ (borrowingFeePerHour + fundingFeePerHour)<br/><br/>"
    "Warning thresholds:<br/>"
    "&nbsp;&nbsp;Yellow: &lt; 1 week to liquidation<br/>"
    "&nbsp;&nbsp;Red: &lt; 24 hours to liquidation<br/>"
    "&nbsp;&nbsp;Flashing: &lt; 1 hour to liquidation"
))

story.append(h2("7.5 Liquidation Screen Design"))
story.append(p("When a position is liquidated, a full-screen modal appears:"))
story.append(make_table(
    ["Element", "Content"],
    [
        ["Icon", "Large red X or skull icon"],
        ["Title", "POSITION LIQUIDATED"],
        ["Market info", "5x Long ETH/USD"],
        ["Entry price", "$3,142.50"],
        ["Liquidation price", "$2,844.68"],
        ["Price at liquidation", "$2,840.20"],
        ["Collateral lost", "-$100.00"],
        ["Fees paid", "-$1.90 (position + borrow + liquidation fee)"],
        ["Remaining balance", "$9,898.10 USDC"],
        ["Buttons", "[New Trade] [Add Funds] [Reset Wallet]"],
        ["Disclaimer", "This was a simulation. On real GMX, you would have lost $100 in real USDC."],
    ],
    [2, 5]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 8: POSITION ENGINE
# ═══════════════════════════════════════════════════════════
story.append(h1("8. Position Engine \u2014 TypeScript Implementation"))
story.append(spacer(6))

story.append(p(
    "The PositionEngine is a pure TypeScript class that handles all trading math. It has no dependencies "
    "on React, wagmi, or any blockchain library. It receives price data from the API and manages positions "
    "entirely in memory. State is persisted to localStorage by the Zustand store that wraps it."
))

story.append(h2("8.1 Core Types & Interfaces"))
story.append(code(
"interface SimPosition {<br/>"
"&nbsp;&nbsp;id: string&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// unique position ID<br/>"
"&nbsp;&nbsp;marketKey: MarketKey&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// 'ETH/USD' | 'BTC/USD' | 'SOL/USD' | 'ARB/USD'<br/>"
"&nbsp;&nbsp;marketAddress: string&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// GMX market token address<br/>"
"&nbsp;&nbsp;isLong: boolean<br/>"
"&nbsp;&nbsp;leverage: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// 5, 10, 25, or 50<br/>"
"&nbsp;&nbsp;sizeUsd: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// position notional size<br/>"
"&nbsp;&nbsp;sizeInTokens: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// sizeUsd / entryPrice<br/>"
"&nbsp;&nbsp;collateralUsd: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// initial collateral<br/>"
"&nbsp;&nbsp;entryPrice: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// oracle fill price (max for long, min for short)<br/>"
"&nbsp;&nbsp;currentPrice: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// latest oracle price<br/>"
"&nbsp;&nbsp;liquidationPrice: number&nbsp;&nbsp;&nbsp;// calculated from formula<br/>"
"&nbsp;&nbsp;openPositionFee: number&nbsp;&nbsp;&nbsp;&nbsp;// 0.04% or 0.06% of sizeUsd<br/>"
"&nbsp;&nbsp;openTimestamp: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// ms timestamp<br/>"
"&nbsp;&nbsp;borrowingFactorAtOpen: number&nbsp;// snapshot of cumulative borrow factor<br/>"
"&nbsp;&nbsp;accruedBorrowFee: number&nbsp;&nbsp;&nbsp;&nbsp;// running total of borrow fees<br/>"
"&nbsp;&nbsp;accruedFundingFee: number&nbsp;&nbsp;&nbsp;// running total of funding fees<br/>"
"&nbsp;&nbsp;pnlGross: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// unrealized gross P&L<br/>"
"&nbsp;&nbsp;pnlAfterFees: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// unrealized P&L net of fees<br/>"
"&nbsp;&nbsp;isLiquidated: boolean<br/>"
"&nbsp;&nbsp;isOnChain: boolean&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// simulated on-chain confirmation<br/>"
"}<br/><br/>"
"interface SimAccount {<br/>"
"&nbsp;&nbsp;walletId: string<br/>"
"&nbsp;&nbsp;createdAt: number<br/>"
"&nbsp;&nbsp;startingBalance: number<br/>"
"&nbsp;&nbsp;availableBalance: number<br/>"
"&nbsp;&nbsp;positions: SimPosition[]<br/>"
"&nbsp;&nbsp;tradeHistory: ClosedTrade[]<br/>"
"&nbsp;&nbsp;approvedTokens: Set&lt;string&gt;<br/>"
"&nbsp;&nbsp;is1CTEnabled: boolean<br/>"
"&nbsp;&nbsp;oneCTActionsRemaining: number<br/>"
"&nbsp;&nbsp;oneCTExpiryTimestamp: number<br/>"
"&nbsp;&nbsp;tutorialEnabled: boolean<br/>"
"&nbsp;&nbsp;keeperDelayEnabled: boolean<br/>"
"}"
))

story.append(h2("8.2 PositionEngine Class Methods"))
story.append(make_table(
    ["Method", "Parameters", "Returns", "Description"],
    [
        ["openPosition", "marketKey, isLong, collateralUsd, leverage, currentPrice, marketData", "SimPosition", "Creates a new position at oracle fill price, deducts position fee from balance"],
        ["closePosition", "positionId, currentPrice, marketData", "ClosedTrade", "Closes position, calculates final P&L after all fees, returns collateral + P&L to balance"],
        ["updatePrice", "positionId, currentPrice, marketData", "void", "Updates current price, recalculates P&L, accrues borrow/funding fees, checks liquidation"],
        ["calculatePnl", "position, currentPrice", "{ gross, afterFees }", "Calculates gross and net P&L"],
        ["calculateLiquidationPrice", "position, marketData", "number", "Exact formula from Section 7.1"],
        ["calculatePositionFee", "sizeUsd, marketData, isPositiveImpact", "number", "0.04% or 0.06% based on OI balance"],
        ["accrueBorrowFee", "position, borrowingFactorPerSecond, elapsedSeconds", "number", "Per-second accrual from Section 4.2"],
        ["accrueFundingFee", "position, fundingFactorPerSecond, longsPayShorts, elapsedSeconds", "number", "Per-second accrual from Section 4.3"],
        ["checkLiquidation", "position, currentPrice", "boolean", "Checks if position should be liquidated"],
        ["approveToken", "tokenAddress", "void", "Records approval in account state"],
        ["isTokenApproved", "tokenAddress", "boolean", "Checks if token has been approved"],
    ],
    [2, 2.5, 1.5, 2]
))

story.append(h2("8.3 P&L Calculation"))
story.append(formula(
    "// Gross P&L<br/>"
    "if (isLong):<br/>"
    "&nbsp;&nbsp;pnlGross = (currentPrice - entryPrice) * sizeInTokens<br/>"
    "if (isShort):<br/>"
    "&nbsp;&nbsp;pnlGross = (entryPrice - currentPrice) * sizeInTokens<br/><br/>"
    "// P&L After Fees<br/>"
    "pnlAfterFees = pnlGross<br/>"
    "&nbsp;&nbsp;- openPositionFee&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// already paid<br/>"
    "&nbsp;&nbsp;- accruedBorrowFee&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// accumulated since open<br/>"
    "&nbsp;&nbsp;- accruedFundingFee&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// accumulated since open<br/>"
    "&nbsp;&nbsp;- closePositionFee&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// estimated at current size<br/><br/>"
    "// P&L Percentage (relative to collateral)<br/>"
    "pnlPercent = (pnlAfterFees / collateralUsd) * 100"
))

story.append(h2("8.4 Fee Accrual Logic"))
story.append(p(
    "Fees are accrued every time the price updates (every 3 seconds). The elapsed time since the last "
    "update is used to calculate the incremental fee:"
))
story.append(formula(
    "// Called every 3 seconds during price poll<br/>"
    "const elapsedSeconds = (Date.now() - lastUpdateTime) / 1000<br/>"
    "const incrementalBorrowFee = sizeUsd * borrowingFactorPerSecond * elapsedSeconds<br/>"
    "const incrementalFundingFee = sizeUsd * fundingFactorPerSecond * elapsedSeconds<br/>"
    "position.accruedBorrowFee += incrementalBorrowFee<br/>"
    "position.accruedFundingFee += incrementalFundingFee<br/>"
    "// Check if smaller side pays zero borrow<br/>"
    "if (skipBorrowFeeForSmallerSide &amp;&amp; isSmallerSide) {<br/>"
    "&nbsp;&nbsp;position.accruedBorrowFee -= incrementalBorrowFee // undo<br/>"
    "}"
))

story.append(h2("8.5 Liquidation Check Logic"))
story.append(formula(
    "// Called every price update (3 seconds)<br/>"
    "function checkLiquidation(position, currentPrice, marketData):<br/>"
    "&nbsp;&nbsp;const collateralValue = position.collateralUsd // after fees deducted<br/>"
    "&nbsp;&nbsp;const pnl = calculatePnl(position, currentPrice).afterFees<br/>"
    "&nbsp;&nbsp;const remainingCollateral = collateralValue + pnl<br/>"
    "&nbsp;&nbsp;const minCollateral = position.sizeUsd * marketData.minCollateralFactor<br/>"
    "&nbsp;&nbsp;if (remainingCollateral &lt;= minCollateral):<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;return true // LIQUIDATED<br/>"
    "&nbsp;&nbsp;return false // SAFE<br/><br/>"
    "// If liquidated:<br/>"
    "// 1. Mark position as isLiquidated = true<br/>"
    "// 2. Calculate all fees (close position fee + borrow + funding + liquidation fee)<br/>"
    "// 3. Deduct all fees from remaining collateral<br/>"
    "// 4. Remaining goes to 'LP pool' (i.e., destroyed / not returned to user)<br/>"
    "// 5. Update availableBalance: NO funds returned<br/>"
    "// 6. Show liquidation screen (Section 7.5)"
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 9: STATE MANAGEMENT
# ═══════════════════════════════════════════════════════════
story.append(h1("9. State Management (localStorage + Zustand)"))
story.append(spacer(6))

story.append(h2("9.1 Data Schema"))
story.append(code(
"// localStorage key: 'easygmx-paper'<br/>"
"interface PaperTradingState {<br/>"
"&nbsp;&nbsp;walletId: string&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// random UUID<br/>"
"&nbsp;&nbsp;createdAt: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// timestamp<br/>"
"&nbsp;&nbsp;startingBalance: number&nbsp;&nbsp;&nbsp;&nbsp;// user's chosen starting balance<br/>"
"&nbsp;&nbsp;availableBalance: number&nbsp;&nbsp;&nbsp;&nbsp;// current free USDC (after fees &amp; positions)<br/>"
"&nbsp;&nbsp;positions: SimPosition[]&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// currently open (max 1 in v1)<br/>"
"&nbsp;&nbsp;tradeHistory: ClosedTrade[]&nbsp;&nbsp;// all closed trades<br/>"
"&nbsp;&nbsp;approvedTokens: string[]&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// tokens that have been 'approved'<br/>"
"&nbsp;&nbsp;totalPnl: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// lifetime P&amp;L<br/>"
"&nbsp;&nbsp;totalTrades: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// number of closed trades<br/>"
"&nbsp;&nbsp;winCount: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// profitable trades<br/>"
"&nbsp;&nbsp;lossCount: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// losing trades<br/>"
"&nbsp;&nbsp;liquidationCount: number&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// times liquidated<br/>"
"&nbsp;&nbsp;settings: {<br/>"
"&nbsp;&nbsp;&nbsp;&nbsp;tutorialEnabled: boolean&nbsp;&nbsp;&nbsp;// default: true<br/>"
"&nbsp;&nbsp;&nbsp;&nbsp;keeperDelayEnabled: boolean&nbsp;// default: true<br/>"
"&nbsp;&nbsp;&nbsp;&nbsp;showPnlAfterFees: boolean&nbsp;&nbsp;// default: true<br/>"
"&nbsp;&nbsp;&nbsp;&nbsp;is1CTEnabled: boolean&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// default: false<br/>"
"&nbsp;&nbsp;&nbsp;&nbsp;oneCTActionsRemaining: number// default: 90<br/>"
"&nbsp;&nbsp;&nbsp;&nbsp;oneCTExpiryTimestamp: number// 7 days from activation<br/>"
"&nbsp;&nbsp;&nbsp;&nbsp;showGasFees: boolean&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// default: true<br/>"
"&nbsp;&nbsp;}<br/>"
"}"
))

story.append(h2("9.2 Save/Load Strategy"))
story.append(bullet("Save: After every state change (position open, close, price update, fee accrual)"))
story.append(bullet("Save method: Zustand middleware that writes to localStorage on every setState"))
story.append(bullet("Debounce: 500ms debounce on saves during rapid price updates to avoid thrashing"))
story.append(bullet("Load: On app startup, read from localStorage. If corrupt/missing, start fresh."))
story.append(bullet("Version field: Include schema version for future migrations"))
story.append(bullet("No encryption: Data is not sensitive (fake balances only)"))

story.append(h2("9.3 Balance & Trade History"))
story.append(p("The availableBalance tracks the fake USDC the user can trade with:"))
story.append(formula(
    "// On position open:<br/>"
    "availableBalance -= collateralUsd&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// collateral locked<br/>"
    "availableBalance -= openPositionFee&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// fee deducted immediately<br/>"
    "// Execution fee is NOT deducted (shown but not charged in paper mode)<br/><br/>"
    "// On position close (profitable):<br/>"
    "availableBalance += collateralUsd&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// collateral returned<br/>"
    "availableBalance += pnlAfterFees&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// profit added<br/>"
    "// Close position fee is deducted from P&amp;L before return<br/><br/>"
    "// On position close (loss, not liquidated):<br/>"
    "availableBalance += max(0, collateralUsd + pnlAfterFees)&nbsp;&nbsp;// never go negative<br/><br/>"
    "// On liquidation:<br/>"
    "availableBalance += 0&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// nothing returned<br/>"
    "// Total loss = collateralUsd"
))

story.append(h2("9.4 Reset & Top-Up Flows"))

story.append(h3("Reset Wallet"))
story.append(bullet("Trigger: Settings \u2192 'Reset Wallet' button"))
story.append(bullet("Confirmation modal: 'Start fresh? Your positions and trade history will be deleted.'"))
story.append(bullet("Options: [Cancel] [Reset with $10K] [Reset with $100K] [Reset with $1M] [Custom...]"))
story.append(bullet("Action: Clear entire localStorage key, create new wallet with selected balance"))

story.append(h3("Top-Up Balance"))
story.append(bullet("Trigger: Settings \u2192 'Add Funds' button, or when balance hits $0"))
story.append(bullet("Modal: 'Add fake USDC to your balance' with preset amounts [$1K $5K $10K $50K] + custom"))
story.append(bullet("Action: Add selected amount to availableBalance. Trade history is preserved."))
story.append(bullet("startingBalance is NOT changed (tracks original), but totalPnl adjusts"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 10: API INTEGRATION
# ═══════════════════════════════════════════════════════════
story.append(h1("10. API Integration \u2014 Every Endpoint"))
story.append(spacer(6))

story.append(h2("10.1 GMX Oracle Keeper API"))
story.append(make_table(
    ["Endpoint", "Method", "Data Returned", "Poll Frequency"],
    [
        ["/prices/tickers", "GET", "Min/max prices per token, oracle decimals", "3 seconds"],
        ["/prices/ohlcv", "GET", "OHLCV candle data for charts", "On demand"],
        ["/markets", "GET", "Market list with configs", "On startup"],
        ["/tokens", "GET", "Token addresses, decimals, symbols", "On startup"],
    ],
    [2, 0.8, 2.5, 1.5]
))
story.append(p("Base URL: <font face='Courier' size=8>https://arbitrum-api.gmxinfra.io</font>"))

story.append(h2("10.2 GMX API v1 (Market Info & Fees)"))
story.append(make_table(
    ["Endpoint", "Method", "Data Returned", "Poll Frequency"],
    [
        ["/markets/info", "GET", "Fee factors, OI, pool amounts, borrow/funding rates", "10 seconds"],
        ["/markets/tickers", "GET", "Market tickers with OI and rates", "5 seconds"],
        ["/tokens/info", "GET", "Token prices and balances", "10 seconds"],
    ],
    [2, 0.8, 2.5, 1.5]
))
story.append(p("Base URL: <font face='Courier' size=8>https://arbitrum.gmxapi.io/api/v1</font>"))

story.append(h3("Critical Fields from /markets/info"))
story.append(make_table(
    ["Field", "Type", "Used For"],
    [
        ["positionFeeFactorForBalanceWasImproved", "number (30-decimal)", "Position fee (0.04%)"],
        ["positionFeeFactorForBalanceWasNotImproved", "number (30-decimal)", "Position fee (0.06%)"],
        ["borrowingFactorPerSecondForLongs", "number (30-decimal)", "Borrow fee accrual for longs"],
        ["borrowingFactorPerSecondForShorts", "number (30-decimal)", "Borrow fee accrual for shorts"],
        ["fundingFactorPerSecond", "number (30-decimal)", "Funding rate accrual"],
        ["longsPayShorts", "boolean", "Direction of funding flow"],
        ["openInterestLongUsd", "number", "Long OI (determines positive/negative impact)"],
        ["openInterestShortUsd", "number", "Short OI (determines positive/negative impact)"],
        ["minCollateralFactor", "number (30-decimal)", "Liquidation threshold"],
        ["liquidationFeeFactor", "number (30-decimal)", "Liquidation fee rate"],
    ],
    [3, 1.5, 2.5]
))

story.append(h2("10.3 Binance WebSocket (Fallback)"))
story.append(p(
    "If the GMX API is unreachable for more than 30 seconds, we fall back to Binance WebSocket for spot "
    "prices. These are close to but not identical to GMX oracle prices. A warning banner is shown: "
    "'Using fallback prices \u2014 may differ from GMX oracle'."
))
story.append(code(
"// Binance WebSocket endpoint<br/>"
"wss://stream.binance.com:9443/ws<br/>"
"// Subscribe to ticker streams for our 4 markets:<br/>"
"ethusdt@ticker<br/>"
"btcusdt@ticker<br/>"
"solusdt@ticker<br/>"
"arbusdt@ticker"
))

story.append(h2("10.4 Rate Limiting & Caching"))
story.append(bullet("GMX API: No documented rate limit. Self-impose 1 request/second max per endpoint."))
story.append(bullet("Local cache: 3-second TTL for prices, 10-second TTL for market info, 60-second TTL for tokens."))
story.append(bullet("Cache invalidation: On position open/close, force-refresh market info for fee accuracy."))
story.append(bullet("HTTP timeout: 5 seconds. On timeout, use cached data."))
story.append(bullet("Concurrent requests: Batch price + market info requests where possible."))

story.append(h2("10.5 Error Handling (Bad Data Protection)"))
story.append(p("Critical: Never liquidate a user on bad data. If API returns suspicious values:"))
story.append(bullet("Price is 0 or negative: Ignore update, show 'Price feed unavailable' warning, freeze trading"))
story.append(bullet("Price changes >20% in a single update: Ignore update, log warning, show stale price indicator"))
story.append(bullet("API returns NaN/Infinity: Ignore update, use cached data"))
story.append(bullet("All APIs down for >60 seconds: Show modal 'Market data unavailable. Trading paused until connection restores.'"))
story.append(bullet("Position is open during API outage: Keep last known price, do NOT liquidate, show warning"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 11: TUTORIAL SYSTEM
# ═══════════════════════════════════════════════════════════
story.append(h1("11. Tutorial System Design"))
story.append(spacer(6))

story.append(h2("11.1 Tutorial Mode vs Power User Mode"))
story.append(make_table(
    ["Feature", "Tutorial ON (default)", "Tutorial OFF"],
    [
        ["Info tooltips on fake wallet", "Yes \u2014 explains what each step does on real GMX", "No tooltips"],
        ["Keeper delay animation", "Full 4-step animation (2-8s)", "Fast 2-second animation"],
        ["Fee breakdown", "Expanded by default with explanations", "Collapsed, click to expand"],
        ["First-time hints", "Yes \u2014 highlights new elements", "No hints"],
        ["1CT promotion", "After 3 trades", "Available in settings only"],
        ["Liquidation warning", "Extra educational popup", "Standard warning only"],
    ],
    [2, 2.5, 2.5]
))

story.append(h2("11.2 Tooltip Content for Every Step"))
story.append(make_table(
    ["Screen", "Tooltip Title", "Content"],
    [
        ["Landing", "What is paper trading?", "This simulator lets you practice GMX trading with fake money. Prices and fees are real, but your balance is not. When you're ready, you can switch to real trading."],
        ["Market select", "What are perpetual futures?", "Perpetual futures (perps) let you bet on whether a token's price will go up or down, with leverage. You don't own the token \u2014 you're trading a contract."],
        ["Trade setup", "What is leverage?", "Leverage multiplies your exposure. 5x leverage means a $100 position controls $500. Profits are 5x bigger, but so are losses. You can lose your entire collateral."],
        ["Trade setup", "What is the position fee?", "GMX charges 0.04-0.06% of your position size when you open AND when you close. The lower rate applies if your trade helps balance the pool."],
        ["Fake wallet (approve)", "Why do I need to approve?", "On real GMX, you must approve the smart contract to spend your USDC. This is a one-time step per token. The approval is unlimited so you won't need to approve again."],
        ["Fake wallet (sign)", "What am I signing?", "On real GMX, this signs a transaction that: 1) Sends your USDC to the order vault, 2) Sends ETH for the keeper, 3) Creates the order."],
        ["Keeper wait", "What is a keeper?", "A keeper is an automated bot that executes your order. It waits for a fresh price from the Chainlink oracle, then submits the execution on-chain. This takes 2-8 seconds."],
        ["Position live", "What are borrow fees?", "Borrow fees accrue every second while your position is open. The rate depends on pool utilization (45-130% annualized). The smaller OI side pays zero borrow fees."],
        ["Position live", "What are funding rates?", "Funding flows from the larger OI side to the smaller side. If more people are long, longs pay shorts. This rate changes over time based on OI balance."],
        ["Close position", "Why is close slippage 3%?", "GMX uses wider slippage for close orders (3% vs 0.5%) to reduce the chance of your close order being cancelled by the keeper."],
        ["Liquidation", "What happened?", "Your collateral dropped below the minimum required. GMX closed your entire position. All remaining collateral after fees goes to the liquidity pool. This is how real liquidation works."],
    ],
    [1.5, 2, 3.5]
))

story.append(h2("11.3 Progressive Disclosure Strategy"))
story.append(p(
    "Tutorial content is shown progressively. First-time users see everything. After 5 trades, basic tooltips "
    "stop appearing. Advanced tooltips (about funding, borrow mechanics) continue until 10 trades. After that, "
    "only new feature tooltips appear (e.g., when 1CT is enabled for the first time). The user can toggle "
    "tutorial mode back on in settings at any time."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 12: SETTINGS
# ═══════════════════════════════════════════════════════════
story.append(h1("12. Settings & Configuration"))
story.append(spacer(6))

story.append(h2("12.1 Starting Balance Selection"))
story.append(make_table(
    ["Preset", "Amount", "Target User"],
    [
        ["$10,000", "10,000 USDC", "Casual trader, realistic position sizes"],
        ["$100,000", "100,000 USDC", "Experienced trader, larger positions"],
        ["$1,000,000", "1,000,000 USDC", "Whale simulation, stress testing"],
        ["Custom", "1 to 10,000,000 USDC", "Any amount the user wants"],
    ],
    [1.5, 1.5, 4]
))

story.append(h2("12.2 Top-Up Flow"))
story.append(bullet("Available at: Settings \u2192 'Add Funds', or when balance = $0"))
story.append(bullet("Presets: $1,000 / $5,000 / $10,000 / $50,000 / Custom"))
story.append(bullet("Confirmation: 'Add $X,XXX to your balance? Your trade history will be preserved.'"))
story.append(bullet("Effect: availableBalance += amount. startingBalance unchanged."))

story.append(h2("12.3 Reset Wallet"))
story.append(bullet("Available at: Settings \u2192 'Reset Wallet'"))
story.append(bullet("Confirmation: 'Start fresh? All positions and history will be deleted. This cannot be undone.'"))
story.append(bullet("Options: Reset with $10K / $100K / $1M / Custom"))
story.append(bullet("Effect: Entire localStorage cleared, new wallet created"))

story.append(h2("12.4 Toggle: Classic / 1CT Mode"))
story.append(bullet("Default: Classic Mode (full wallet popups)"))
story.append(bullet("1CT Setup: Fake wallet popup to sign '1CT activation message', 90 actions, 7-day expiry"))
story.append(bullet("1CT Active: No wallet popups, '\u26a1 Gasless' badge on trade button, action counter in header"))
story.append(bullet("1CT Expired: Auto-revert to Classic Mode, notification to renew"))

story.append(h2("12.5 Toggle: Tutorial On/Off"))
story.append(bullet("Default: ON"))
story.append(bullet("When OFF: No tooltips, no first-time hints, no educational popups"))
story.append(bullet("Keeper delay: When tutorial OFF + keeper delay ON, delay reduced to 1-2 seconds"))

story.append(h2("12.6 Toggle: Keeper Delay On/Off"))
story.append(bullet("Default: ON (matches real GMX)"))
story.append(bullet("When OFF: Orders fill instantly (1-second animation), no cancel option"))
story.append(bullet("Note: Turning this off makes the experience less realistic but faster for experienced users"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 13: EDGE CASES
# ═══════════════════════════════════════════════════════════
story.append(h1("13. Edge Cases & Error Handling"))
story.append(spacer(6))

story.append(make_table(
    ["Scenario", "Handling"],
    [
        ["Browser tab closed during keeper wait", "On re-open, check localStorage. If pending order exists and >10 seconds have passed, fill it. If <10 seconds, show 'Processing...' and resume timer."],
        ["Multiple browser tabs open", "Use storage event listener to sync state. Last-write-wins. Not critical (paper trading, not banking)."],
        ["Oracle price returns $0", "Ignore update, freeze trading, show 'Price feed error' warning, do NOT liquidate positions on bad data."],
        ["Price doesn't change for hours", "Borrow fees keep accruing. P&L slowly goes negative. This is realistic and educational."],
        ["Balance can't cover borrow fees", "Liquidate position when remaining collateral < minCollateralFactor * sizeUsd."],
        ["Mobile browser kills tab", "Save state aggressively (every price update with 500ms debounce). On re-open, resume from saved state."],
        ["User clears localStorage", "Everything gone. Show 'Welcome back \u2014 start fresh?' landing page. Cannot recover without backend."],
        ["Network offline", "Use cached prices with 'Prices may be stale' warning. Prevent new trades if offline >30 seconds."],
        ["Position open when API goes down", "Keep last known price. Do NOT liquidate. Show warning. Resume normal operation when API returns."],
        ["Negative balance after fee accrual", "This should not happen (liquidation triggers first). If it does due to a bug, clamp to $0 and show 'Position liquidated'."],
        ["Rapid price changes (flash crash)", "Process each price update sequentially. If price moves >20% in one update, flag as suspicious and skip (protects against bad data)."],
        ["User tries to trade with $0 balance", "Button disabled with 'Insufficient balance' message. Show 'Add Funds' link."],
        ["1CT action counter reaches 0 mid-trade", "Current trade completes. Next trade shows '1CT session expired. Renew?' popup."],
        ["Order cancelled by keeper (price moved)", "Return collateral to balance. Show toast: 'Order cancelled \u2014 price moved beyond your slippage tolerance (0.5%). Try again.'"],
    ],
    [2.5, 4.5]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 14: CONTRACT REFERENCE (MAINNET)
# ═══════════════════════════════════════════════════════════
story.append(h1("14. GMX V2 Contract Reference (Arbitrum Mainnet)"))
story.append(spacer(6))

story.append(p(
    "While EasyGMX Paper Trading does not interact with any blockchain, these addresses are referenced in "
    "the fake wallet popup for educational purposes and may be needed for future mainnet mode integration."
))

story.append(make_table(
    ["Contract", "Address"],
    [
        ["DataStore", "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8"],
        ["RoleStore", "0x3c3d99FD298f679DBC2CEcd132b4eC4d0F5e6e72"],
        ["Reader (SyntheticsReader)", "0x470fbC46bcC0f16532691Df360A07d8Bf5ee0789"],
        ["ExchangeRouter", "0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41"],
        ["SyntheticsRouter", "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6"],
        ["OrderVault", "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5"],
        ["OrderHandler", "0x63492B775e30a9E6b4b4761c12605EB9d071d5e9"],
        ["Oracle", "0x7F01614cA5198Ec979B1aAd1DAF0DE7e0a215BDF"],
        ["EventEmitter", "0xC8ee91A54287DB53897056e12D9819156D3822Fb"],
        ["GelatoRelayRouter", "0xa9090E2fd6cD8Ee397cF3106189A7E1CFAE6C59C"],
        ["SubaccountGelatoRelayRouter", "0x517602BaC704B72993997820981603f5E4901273"],
    ],
    [2.5, 4.5]
))

story.append(h3("Token Addresses"))
story.append(make_table(
    ["Token", "Address", "Decimals"],
    [
        ["USDC (native)", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "6"],
        ["WETH", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "18"],
        ["USDC.e (legacy)", "0xFF970A616C4449D6FaBA68550c9ef83fC09911b2", "6"],
        ["ARB", "0x912CE59144191C1204E64559FE8253a0e49E6548", "18"],
        ["WBTC", "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", "8"],
    ],
    [2, 4, 1]
))

story.append(h3("Market Addresses"))
story.append(make_table(
    ["Market", "Address"],
    [
        ["ETH/USD", "0x70d95539653b3d7285587a6B7aE5565DA9cF4c1D"],
        ["BTC/USD", "0x4793697C2462A1E4b0b1985D6F7a5030B6600E3c"],
        ["SOL/USD", "0x3193c45D49C07DB9bE9Fb13e6e7e7e5A0b4a1c51"],
        ["ARB/USD", "0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407"],
    ],
    [2, 5]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 15: CONTRACT REFERENCE (TESTNET)
# ═══════════════════════════════════════════════════════════
story.append(h1("15. GMX V2 Contract Reference (Arbitrum Sepolia Testnet)"))
story.append(spacer(6))

story.append(p(
    "These addresses are for GMX V2 on Arbitrum Sepolia (chainId 421614). While not used in the paper "
    "trading simulator, they are documented here for future reference if a testnet mode is added (Option B "
    "from the architecture analysis). All contracts have been verified as deployed on-chain."
))

story.append(make_table(
    ["Contract", "Address"],
    [
        ["ExchangeRouter", "0xEd50B2A1eF0C35DAaF08Da6486971180237909c3"],
        ["DataStore", "0xCF4c2C4c53157BcC01A596e3788fFF69cBBCD201"],
        ["SyntheticsRouter", "0x72F13a44C8ba16a678CAD549F17bc9e06d2B8bD2"],
        ["SyntheticsReader", "0x4750376b9378294138Cf7B7D69a2d243f4940f71"],
        ["OrderHandler", "0x000F692690F6C39660AfB878D277f038fb3a8eC6"],
        ["Oracle", "0x0dC4e24C63C24fE898Dda574C962Ba7Fbb146964"],
        ["OrderVault", "0x1b8AC606de71686fd2a1AEDEcb6E0EFba28909a2"],
        ["GelatoRelayRouter", "0xD2f52a70224d3453ea17944ABC12772793987FA6"],
        ["SubaccountGelatoRelayRouter", "0x43947140EEE26b82155baA18FDB746A05C700DCE"],
        ["Printer (mint test tokens)", "0x983bf2415F54E1F309f58044De34ee16A9dB28D1"],
    ],
    [2.5, 4.5]
))

story.append(h3("Testnet Tokens"))
story.append(make_table(
    ["Token", "Address", "Decimals"],
    [
        ["WETH", "0x980B62Da83eFf3D4576c647993b0c1D7faf17c73", "18"],
        ["BTC", "0xF79cE1Cf38A09D572b021B4C5548b75A14082F12", "8"],
        ["USDC.SG (Stargate)", "0x3253a335E7bFfB4790Aa4C25C4250d206E9b9773", "6"],
        ["USDT.SG (Stargate)", "0x095f40616FA98Ff75D1a7D0c68685c5ef806f110", "6"],
    ],
    [2, 4, 1]
))

story.append(h3("Testnet RPC & Explorer"))
story.append(bullet("RPC: <font face='Courier' size=8>https://sepolia-rollup.arbitrum.io/rpc</font>"))
story.append(bullet("Explorer: <font face='Courier' size=8>https://sepolia.arbiscan.io</font>"))
story.append(bullet("Faucet: <font face='Courier' size=8>https://faucet.quicknode.com/arbitrum/sepolia</font>"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 16: IMPLEMENTATION PHASES
# ═══════════════════════════════════════════════════════════
story.append(h1("16. Implementation Phases"))
story.append(spacer(6))

story.append(p(
    "The implementation is broken into phases that deliver working software at each stage. Each phase builds "
    "on the previous one, adding complexity incrementally."
))

story.append(make_table(
    ["Phase", "Scope", "Key Deliverables", "Est. Time"],
    [
        ["Phase 1: Core Engine", "PositionEngine, fee calc, P&L, localStorage", "TypeScript engine with all trading math, unit tests, no UI", "3-4 days"],
        ["Phase 2: Basic Trading", "Landing + Market Select + Trade Setup + Position Live (no fake wallet, no keeper delay)", "Working end-to-end paper trading with instant fills", "3-4 days"],
        ["Phase 3: Realism Layer", "Fake wallet popups, keeper delay animation, order cancellation, oracle fill price", "Full GMX-style trading flow with educational popups", "3-4 days"],
        ["Phase 4: Fee Accuracy", "Dynamic fees from API, borrow accrual, funding accrual, liquidation check", "Position fees match GMX exactly, P&L after fees toggle", "2-3 days"],
        ["Phase 5: 1CT Mode", "One-Click Trading toggle, setup flow, action counter, session expiry", "Two trading modes with seamless switching", "2-3 days"],
        ["Phase 6: Polish", "Tutorial system, share P&L, trade history, settings, mobile responsive, error handling", "Production-quality UX with all edge cases handled", "3-4 days"],
    ],
    [1.5, 2, 2.5, 1]
))

story.append(spacer(10))
story.append(hr())
story.append(p(
    "<b>End of Specification.</b> This document contains every detail needed to implement EasyGMX Paper Trading: "
    "every screen, every button state, every fee formula, every edge case, every API endpoint, and every "
    "tutorial tooltip. The implementation should follow this specification precisely to ensure the paper "
    "trading experience faithfully replicates the real GMX V2 trading experience."
))

# ─── Build PDF ────────────────────────────────────────────
doc.build(story)
print("PDF generated successfully!")
