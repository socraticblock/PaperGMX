#!/usr/bin/env python3
"""
EasyGMX Technical Roadmap - Complete PDF Generation
A comprehensive technical roadmap for building a simplified GMX trading frontend.
"""

import sys, os, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
    CondPageBreak, Flowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate

# ─────────────────────────────────────────────────────────────────────
# 1. FONT REGISTRATION
# ─────────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans-Bold', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansReg', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('LiberationSans', normal='LiberationSans', bold='LiberationSans-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansMono-BoldOblique')

# ─────────────────────────────────────────────────────────────────────
# 2. COLOR PALETTE (from cascade generator)
# ─────────────────────────────────────────────────────────────────────
PAGE_BG       = colors.HexColor('#eff0f1')
SECTION_BG    = colors.HexColor('#ecedee')
CARD_BG       = colors.HexColor('#e7eaec')
TABLE_STRIPE  = colors.HexColor('#f0f2f3')
HEADER_FILL   = colors.HexColor('#3d5966')
COVER_BLOCK   = colors.HexColor('#587280')
BORDER        = colors.HexColor('#a6b9c3')
ICON          = colors.HexColor('#41748e')
ACCENT        = colors.HexColor('#b24825')
ACCENT_2      = colors.HexColor('#75c260')
TEXT_PRIMARY   = colors.HexColor('#212325')
TEXT_MUTED     = colors.HexColor('#7f8589')
SEM_SUCCESS   = colors.HexColor('#467d58')
SEM_WARNING   = colors.HexColor('#9d7f44')
SEM_ERROR     = colors.HexColor('#af564e')
SEM_INFO      = colors.HexColor('#4b7aa8')

# ─────────────────────────────────────────────────────────────────────
# 3. STYLES
# ─────────────────────────────────────────────────────────────────────
page_w, page_h = A4
left_margin = 1.0 * inch
right_margin = 1.0 * inch
top_margin = 0.8 * inch
bottom_margin = 0.8 * inch
available_width = page_w - left_margin - right_margin

styles = getSampleStyleSheet()

# H1 - Major section heading
h1_style = ParagraphStyle(
    name='H1', fontName='LiberationSerif', fontSize=20, leading=28,
    spaceBefore=24, spaceAfter=12, textColor=TEXT_PRIMARY,
    alignment=TA_LEFT
)

# H2 - Subsection heading
h2_style = ParagraphStyle(
    name='H2', fontName='LiberationSerif', fontSize=14, leading=20,
    spaceBefore=18, spaceAfter=8, textColor=HEADER_FILL,
    alignment=TA_LEFT
)

# H3 - Minor heading
h3_style = ParagraphStyle(
    name='H3', fontName='LiberationSerif', fontSize=12, leading=16,
    spaceBefore=12, spaceAfter=6, textColor=ICON,
    alignment=TA_LEFT
)

# Body text
body_style = ParagraphStyle(
    name='Body', fontName='LiberationSerif', fontSize=10.5, leading=17,
    spaceBefore=0, spaceAfter=6, textColor=TEXT_PRIMARY,
    alignment=TA_JUSTIFY
)

# Code / technical style
code_style = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=8.5, leading=13,
    spaceBefore=4, spaceAfter=4, textColor=TEXT_PRIMARY,
    backColor=CARD_BG, leftIndent=12, rightIndent=12,
    alignment=TA_LEFT
)

# Table header
tbl_header_style = ParagraphStyle(
    name='TblHeader', fontName='LiberationSerif', fontSize=9.5,
    leading=13, textColor=colors.white, alignment=TA_CENTER
)

# Table cell
tbl_cell_style = ParagraphStyle(
    name='TblCell', fontName='LiberationSerif', fontSize=9,
    leading=13, textColor=TEXT_PRIMARY, alignment=TA_LEFT
)

tbl_cell_center = ParagraphStyle(
    name='TblCellCenter', fontName='LiberationSerif', fontSize=9,
    leading=13, textColor=TEXT_PRIMARY, alignment=TA_CENTER
)

# Caption
caption_style = ParagraphStyle(
    name='Caption', fontName='LiberationSerif', fontSize=9,
    leading=13, textColor=TEXT_MUTED, alignment=TA_CENTER,
    spaceBefore=3, spaceAfter=6
)

# Muted note
note_style = ParagraphStyle(
    name='Note', fontName='LiberationSerif', fontSize=9,
    leading=14, textColor=TEXT_MUTED, alignment=TA_LEFT,
    leftIndent=12, borderPadding=6
)

# Bullet style
bullet_style = ParagraphStyle(
    name='Bullet', fontName='LiberationSerif', fontSize=10.5,
    leading=17, spaceBefore=2, spaceAfter=2, textColor=TEXT_PRIMARY,
    leftIndent=24, bulletIndent=12, alignment=TA_LEFT
)

# ─────────────────────────────────────────────────────────────────────
# 4. TOC DOC TEMPLATE
# ─────────────────────────────────────────────────────────────────────
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ─────────────────────────────────────────────────────────────────────
# 5. HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────
def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def H1(text):
    return add_heading(text, h1_style, level=0)

def H2(text):
    return add_heading(text, h2_style, level=1)

def H3(text):
    return add_heading(text, h3_style, level=2)

def P(text):
    return Paragraph(text, body_style)

def CODE(text):
    return Paragraph(text, code_style)

def BULLET(text):
    return Paragraph(text, bullet_style)

def NOTE(text):
    return Paragraph('<i>%s</i>' % text, note_style)

def CAPTION(text):
    return Paragraph(text, caption_style)

def make_table(headers, rows, col_ratios=None):
    """Create a styled table with headers and rows."""
    data = []
    header_row = [Paragraph('<b>%s</b>' % h, tbl_header_style) for h in headers]
    data.append(header_row)
    for row in rows:
        data.append([Paragraph(str(c), tbl_cell_style) for c in row])

    if col_ratios:
        col_widths = [r * available_width for r in col_ratios]
    else:
        col_widths = [available_width / len(headers)] * len(headers)

    tbl = Table(data, colWidths=col_widths, hAlign='CENTER')

    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    # Alternate row coloring
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))

    tbl.setStyle(TableStyle(style_cmds))
    return tbl

def callout_box(text, bg_color=CARD_BG, border_color=ACCENT):
    """Create a callout/info box."""
    inner = Paragraph(text, ParagraphStyle(
        name='Callout', fontName='LiberationSerif', fontSize=10,
        leading=15, textColor=TEXT_PRIMARY, alignment=TA_LEFT
    ))
    t = Table([[inner]], colWidths=[available_width - 20], hAlign='CENTER')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBEFOREDECOR', (0, 0), (0, -1), 3, border_color),
    ]))
    return t

# ─────────────────────────────────────────────────────────────────────
# 6. BUILD THE DOCUMENT
# ─────────────────────────────────────────────────────────────────────
output_path = '/home/z/my-project/download/EasyGMX_Technical_Roadmap.pdf'

doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=left_margin,
    rightMargin=right_margin,
    topMargin=top_margin,
    bottomMargin=bottom_margin,
    title='EasyGMX Technical Roadmap',
    author='Z.ai',
    creator='Z.ai',
    subject='Technical roadmap for building a simplified GMX trading frontend'
)

story = []

# ═══════════════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════════════
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle(name='TOC1', fontName='LiberationSerif', fontSize=13,
                   leading=20, leftIndent=20, spaceBefore=6, spaceAfter=3),
    ParagraphStyle(name='TOC2', fontName='LiberationSerif', fontSize=11,
                   leading=16, leftIndent=40, spaceBefore=2, spaceAfter=2),
]
story.append(Paragraph('<b>Table of Contents</b>', ParagraphStyle(
    name='TOCTitle', fontName='LiberationSerif', fontSize=22,
    leading=30, spaceBefore=12, spaceAfter=18, textColor=TEXT_PRIMARY
)))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════
# SECTION 1: PROJECT OVERVIEW
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('1. Project Overview'))

story.append(P(
    'EasyGMX is a simplified, mobile-first trading frontend for the GMX V2 decentralized perpetual exchange on Arbitrum. '
    'The core insight is simple: GMX is a powerful protocol with a complex user interface that intimidates newcomers. '
    'Every trade on GMX requires navigating through market selectors, order types, collateral choices, leverage sliders, '
    'fee breakdowns, and a two-phase keeper execution system. For someone who has never traded crypto before, this is '
    'overwhelming. EasyGMX reduces the entire trade flow to four actions: pick a coin, pick a direction, set an amount, '
    'and hit trade. Behind the scenes, every position opened on EasyGMX is a real GMX V2 perpetual position, subject to '
    'the same fees, liquidation rules, and oracle pricing as any trade made directly on GMX.'
))

story.append(P(
    'The project is not a new DeFi protocol. It does not hold user funds, issue tokens, or modify any smart contracts. '
    'It is a frontend interface, a cleaner door to an existing product. The closest analogy is Robinhood: the same trades '
    'that happen on a CEX, but with an interface that removes the intimidation factor. The goal is to onboard new users '
    'who would never try GMX on their own, and to give existing GMX token holders a reason to actually use the protocol '
    'they are invested in. If GMX decides to adopt the interface natively, the project will have succeeded in its mission.'
))

story.append(Spacer(1, 12))
story.append(callout_box(
    '<b>Core Value Proposition:</b> Reduce the GMX trade flow from 8+ decisions to 4 clicks. '
    'Bring the "Aviator feel" of real-time P&amp;L watching to a real leveraged trading product, '
    'without gamification mechanics that attract regulatory scrutiny.'
))
story.append(Spacer(1, 12))

story.append(P(
    'The target markets for the initial launch are the four highest-volume perpetuals on GMX V2: '
    'ETH/USD, BTC/USD, SOL/USD, and ARB/USD. These markets represent the vast majority of GMX trading activity, '
    'with ETH/USD alone accounting for approximately 55% of total volume. Leverage is pre-set at 5x or 10x '
    'to prevent the catastrophic losses that come with 50x-100x leverage, and USDC is the sole collateral token '
    'to eliminate the confusion of choosing between USDC, ETH, WBTC, or other tokens as collateral.'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 2: PRODUCT VISION & USER EXPERIENCE
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('2. Product Vision and User Experience'))

story.append(H2('2.1 Design Philosophy'))

story.append(P(
    'The design philosophy of EasyGMX can be summarized in three principles: simplify without hiding, engage without '
    'gamifying, and educate without lecturing. The interface should feel like a natural extension of GMX, not a separate '
    'product. Every position opened through EasyGMX should be traceable back to GMX, and every user should understand '
    'that they are trading on a real decentralized exchange with real financial risk. The simplification comes from reducing '
    'the number of choices a user must make, not from hiding information. Fees are shown clearly, liquidation prices are '
    'displayed, and the borrow fee is explained in plain language via information buttons.'
))

story.append(H2('2.2 User Flow: Four-Screen Architecture'))

story.append(P(
    'The entire EasyGMX experience is structured around four screens, each representing a step in the user journey. '
    'This architecture intentionally mirrors the simplicity of consumer trading apps like Robinhood, while preserving '
    'the real-time engagement that makes the Aviator game compelling.'
))

# Screen table
screen_headers = ['Screen', 'Purpose', 'Key Elements']
screen_rows = [
    ['1. Landing', 'Wallet connection and first impression',
     'Connect Wallet button, brief tagline, "How it works" link'],
    ['2. Market Select', 'Choose which coin to trade',
     '4 coin cards (BTC, ETH, SOL, ARB) with live prices, wallet balance shown'],
    ['3. Trade Setup', 'Configure and execute the trade',
     'Direction buttons (Up/Down), amount input, leverage selector (5x/10x), fee display, Open Trade button'],
    ['4. Position Live', 'Monitor and manage open position',
     'Live chart, real-time P&L ticker, entry vs current price, Take Profit / Cut Loss buttons'],
]
story.append(Spacer(1, 6))
story.append(make_table(screen_headers, screen_rows, [0.12, 0.30, 0.58]))
story.append(CAPTION('Table 1: Four-screen user flow architecture'))
story.append(Spacer(1, 12))

story.append(H2('2.3 The "Aviator Feel" on Screen 4'))

story.append(P(
    'The key differentiator of EasyGMX is the experience on Screen 4, where the user watches their position tick in '
    'real-time. The P&L counter updates every 1-5 seconds based on the GMX oracle price feed. The user sees their profit '
    'climbing or their loss deepening, and they decide when to close. This is the same psychological engagement loop that '
    'makes Aviator compelling, but applied to a real financial product. The critical design distinction is that EasyGMX never '
    'uses gambling language, leaderboards, or achievement systems. The engagement comes from the real stakes of a real trade, '
    'not from artificial gamification.'
))

story.append(P(
    'When the user clicks "Take Profit" or "Cut Loss," the app submits a decrease-order to GMX. Because of the two-phase '
    'keeper system, there is a 2-10 second delay between clicking and the position actually closing. During this window, '
    'the app displays a "Closing position..." state with a progress indicator. The user understands that the closing price '
    'may differ slightly from what they saw when they clicked, and this is communicated transparently in the UI.'
))

story.append(H2('2.4 Transparent Fees and Risk Disclosure'))

story.append(P(
    'Every screen where a trade decision is made includes clear fee information. On Screen 3 (Trade Setup), the user sees '
    'a single fee estimate, e.g., "Fee: approximately $0.50." An information button next to the fee expands to show the full '
    'breakdown: position fee (0.05% of trade size), price impact (dynamic, usually 0-0.05%), execution fee (network gas cost, '
    'typically $0.15-0.30), and borrow fee (hourly rate displayed as an annualized percentage). The user also sees a maximum '
    'risk line: "You risk: up to $10" for a $10 position. The liquidation price is shown with an information button that '
    'explains: "If BTC drops to $81,028, your position is automatically closed and you lose your $10. This is your maximum '
    'possible loss."'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 3: SYSTEM ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('3. System Architecture'))

story.append(H2('3.1 High-Level Architecture'))

story.append(P(
    'EasyGMX is a client-side web application that communicates directly with GMX smart contracts on Arbitrum. '
    'There is no backend server, no database, and no custodial component. The entire application can run from a static '
    'hosting environment (Vercel, IPFS, or GitHub Pages) because all data is either read from the blockchain via RPC calls '
    'or fetched from GMX public API endpoints. The three core components are the React UI layer, the state management layer '
    'that tracks positions and calculates P&L in real-time, and the GMX contract interaction layer that uses ethers.js '
    'or viem to submit orders and read position data.'
))

arch_headers = ['Component', 'Technology', 'Purpose']
arch_rows = [
    ['UI Layer', 'React / Next.js + Tailwind CSS',
     'Four-screen user interface, mobile-first design'],
    ['State Management', 'Zustand or React Context',
     'Track open positions, calculate P&L, manage UI state'],
    ['Wallet Connection', 'wagmi + RainbowKit',
     'Connect MetaMask/Rabby wallet, sign transactions'],
    ['Contract Read', 'GMX REST API v2 + Reader contract',
     'Fetch positions, prices, fees, market data'],
    ['Contract Write', 'ExchangeRouter + SubaccountGelatoRelayRouter',
     'Submit orders (create, update, close positions)'],
    ['Price Feed', 'GMX REST API /market/tickers + CoinGecko WebSocket',
     'Real-time price updates for charts and P&L display'],
    ['Deployment', 'Vercel or IPFS (static hosting)',
     'No backend server required, fully client-side'],
]
story.append(Spacer(1, 6))
story.append(make_table(arch_headers, arch_rows, [0.18, 0.32, 0.50]))
story.append(CAPTION('Table 2: System architecture component map'))
story.append(Spacer(1, 12))

story.append(H2('3.2 Data Flow: Opening a Trade'))

story.append(P(
    'When a user opens a trade on EasyGMX, the following data flow occurs. Understanding this flow is critical because '
    'it reveals where the two-phase keeper delay enters the process, and where the app must provide feedback to the user.'
))

story.append(CODE(
    'User clicks "Open Trade" on Screen 3\n'
    '    |\n'
    '    v\n'
    'Frontend validates inputs (amount > 0, wallet has USDC balance)\n'
    '    |\n'
    '    v\n'
    'If One-Click Trading is enabled:\n'
    '    Frontend calls SubaccountGelatoRelayRouter.createOrder()\n'
    '    - Gasless: no ETH needed for gas\n'
    '    - Fee paid from USDC via Gelato 1Balance\n'
    '    - No MetaMask popup required\n'
    'Else (classic mode):\n'
    '    Frontend builds multicall transaction:\n'
    '    1. sendWnt(OrderVault, executionFee)\n'
    '    2. sendTokens(USDC, OrderVault, collateralAmount)\n'
    '    3. createOrder(CreateOrderParams)\n'
    '    |\n'
    '    v\n'
    'MetaMask popup: user reviews and confirms (classic mode only)\n'
    '    |\n'
    '    v\n'
    'Transaction sent to Arbitrum (~2 seconds to confirm)\n'
    '    |\n'
    '    v\n'
    'UI shows "Position opening... waiting for keeper" (Screen 4)\n'
    '    |\n'
    '    v\n'
    'GMX Keeper picks up the order (2-10 seconds typical, up to 30s during congestion)\n'
    '    |\n'
    '    v\n'
    'Position opens at keeper execution price (may differ from price when user clicked)\n'
    '    |\n'
    '    v\n'
    'Frontend detects position via Reader contract polling or event listening\n'
    '    |\n'
    '    v\n'
    'Screen 4 displays live P&L, updating every 1-5 seconds from oracle price feed'
))

story.append(H2('3.3 Data Flow: Closing a Trade'))

story.append(P(
    'Closing a trade follows the same two-phase pattern, but uses a decrease order instead of an increase order. '
    'The user clicks "Take Profit" or "Cut Loss" on Screen 4. The app submits a MarketDecrease order via the same '
    'ExchangeRouter or SubaccountGelatoRelayRouter. The keeper executes the close, and the collateral plus any profit '
    '(minus fees) is returned to the user wallet. The entire flow from click to close typically takes 5-15 seconds. '
    'During volatile market conditions, the delay can extend to 30 seconds or more, which is why the UI must clearly '
    'communicate the "Closing position..." state and manage user expectations about the final closing price.'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 4: GMX V2 SMART CONTRACT INTEGRATION
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('4. GMX V2 Smart Contract Integration'))

story.append(H2('4.1 Core Contract Addresses (Arbitrum)'))

story.append(P(
    'All EasyGMX contract interactions happen on Arbitrum (Chain ID: 42161). The following addresses are the core '
    'contracts that EasyGMX needs to interact with. Note that only DataStore and RoleStore are permanent addresses; '
    'all other logic contracts may change on GMX protocol upgrades. The app should fetch the latest addresses from '
    'the GMX SDK or a configuration endpoint rather than hardcoding them.'
))

addr_headers = ['Contract', 'Address', 'Purpose']
addr_rows = [
    ['DataStore', '0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8',
     'Permanent storage for all protocol state'],
    ['Reader', '0x470fbC46bcC0f16532691Df360A07d8Bf5ee0789',
     'Read positions, markets, fees, prices'],
    ['ExchangeRouter', '0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41',
     'Submit orders (multicall pattern)'],
    ['OrderVault', '0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5',
     'Holds execution fees and collateral during order flow'],
    ['OrderHandler', '0x63492B775e30a9E6b4b4761c12605EB9d071d5e9',
     'Processes keeper-executed orders'],
    ['SubaccountGelatoRelayRouter', '0x517602BaC704B72993997820981603f5E4901273',
     'Gasless delegated order execution (1CT)'],
    ['GelatoRelayRouter', '0xa9090E2fd6cD8Ee397cF3106189A7E1CFAE6C59C',
     'Standard gasless relay (non-subaccount)'],
    ['Oracle', '0x7F01614cA5198Ec979B1aAd1DAF0DE7e0a215BDF',
     'Price oracle for all markets'],
]
story.append(Spacer(1, 6))
story.append(make_table(addr_headers, addr_rows, [0.22, 0.43, 0.35]))
story.append(CAPTION('Table 3: GMX V2 core contract addresses on Arbitrum'))
story.append(Spacer(1, 12))

story.append(H2('4.2 Token Addresses'))

token_headers = ['Token', 'Address', 'Usage']
token_rows = [
    ['USDC (Native)', '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
     'Primary collateral for EasyGMX trades'],
    ['WETH', '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
     'Wrapped Ether for gas payments / alternative collateral'],
    ['USDC.e (Legacy)', '0xFF970A616C4449D6FaBA68550c9ef83fC09911b2',
     'Deprecated bridged USDC, do not use'],
]
story.append(Spacer(1, 6))
story.append(make_table(token_headers, token_rows, [0.18, 0.43, 0.39]))
story.append(CAPTION('Table 4: Token addresses on Arbitrum'))
story.append(Spacer(1, 12))

story.append(H2('4.3 Target Markets'))

story.append(P(
    'EasyGMX will launch with the four highest-volume perpetual markets on GMX V2. These markets were selected based '
    'on 24-hour trading volume data from CoinGecko and DefiLlama. ETH/USD dominates with approximately $23.4 million '
    'in daily volume, representing roughly 55% of total GMX V2 Arbitrum volume. BTC/USD follows with an estimated '
    '$8-12 million daily. SOL/USD and ARB/USD round out the top four with $2-5 million and $1-3 million respectively.'
))

market_headers = ['Market', '24h Volume (est.)', 'Collateral Pool', 'Notes']
market_rows = [
    ['ETH/USD', '~$23.4M', 'WETH-USDC', 'Highest volume, most liquid'],
    ['BTC/USD', '~$8-12M', 'WBTC-USDC', 'Multiple pool variants available'],
    ['SOL/USD', '~$2-5M', 'SOL-USDC', 'Growing volume, popular with retail'],
    ['ARB/USD', '~$1-3M', 'ARB-USDC', 'Native Arbitrum token, community favorite'],
]
story.append(Spacer(1, 6))
story.append(make_table(market_headers, market_rows, [0.15, 0.18, 0.22, 0.45]))
story.append(CAPTION('Table 5: Initial target markets ranked by 24h volume'))
story.append(Spacer(1, 12))

story.append(H2('4.4 The createOrder Function'))

story.append(P(
    'The heart of the trading integration is the createOrder function on the ExchangeRouter contract. This function '
    'accepts a single CreateOrderParams struct that contains all the information needed to open, increase, or decrease '
    'a position. For EasyGMX, the key parameters are pre-set: orderType is always MarketIncrease (for opening) or '
    'MarketDecrease (for closing), isLong is determined by the Up/Down button, and the collateral token is always USDC. '
    'The multicall pattern requires three encoded function calls in a single transaction: sendWnt (to pay the execution '
    'fee), sendTokens (to transfer collateral to the OrderVault), and createOrder (to register the order).'
))

story.append(CODE(
    'struct CreateOrderParamsAddresses {\n'
    '    address receiver;                  // User wallet address\n'
    '    address cancellationReceiver;      // Same as receiver\n'
    '    address callbackContract;          // address(0) for no callback\n'
    '    address uiFeeReceiver;             // Optional: your fee receiver\n'
    '    address market;                    // Market address (e.g., BTC/USD)\n'
    '    address initialCollateralToken;    // Always USDC for EasyGMX\n'
    '    address[] swapPath;               // Empty array (no swap needed)\n'
    '}\n'
    '\n'
    'struct CreateOrderParamsNumbers {\n'
    '    uint256 sizeDeltaUsd;              // Position size in USD (e.g., $50 for $10 at 5x)\n'
    '    uint256 initialCollateralDeltaAmount; // USDC amount (6 decimals)\n'
    '    uint256 triggerPrice;              // 0 for market orders\n'
    '    uint256 acceptablePrice;           // Current price + 0.5% slippage\n'
    '    uint256 executionFee;              // From getMinExecutionFee()\n'
    '    uint256 callbackGasLimit;          // 0 for no callback\n'
    '    uint256 minOutputAmount;           // 0 for market orders\n'
    '    uint256 validFromTime;             // 0 for immediate validity\n'
    '}\n'
    '\n'
    '// Order types used by EasyGMX:\n'
    '// MarketIncrease = 2 (open/increase position)\n'
    '// MarketDecrease = 4 (close/decrease position)\n'
))

story.append(H2('4.5 Reading Position Data'))

story.append(P(
    'The Reader contract provides two key functions for position data. The simpler getAccountPositions returns raw position '
    'structs with size, collateral, and direction. The richer getAccountPositionInfoList returns the same positions with '
    'additional fee and pricing context, including unrealized P&L, borrow fees, funding fees, and liquidation prices. '
    'For EasyGMX, the enriched function is preferred because it provides all the data needed for Screen 4 without '
    'requiring separate fee calculations. The Reader contract is a view function, meaning it costs no gas to call and can '
    'be polled frequently for real-time updates.'
))

story.append(CODE(
    '// Get raw positions for an account\n'
    'reader.getAccountPositions(\n'
    '    dataStore,           // 0xFD70de6b...\n'
    '    account,             // User wallet address\n'
    '    start,               // 0 for first page\n'
    '    end                  // 10 for up to 10 positions\n'
    ')  // Returns Position.Props[]\n'
    '\n'
    '// Get enriched positions with fees and P&L\n'
    'reader.getAccountPositionInfoList(\n'
    '    dataStore,           // 0xFD70de6b...\n'
    '    referralStorage,     // address(0) if unused\n'
    '    account,             // User wallet address\n'
    '    markets,             // Array of market addresses to check\n'
    '    marketPrices,        // Array of MarketPrices from oracle\n'
    '    uiFeeReceiver,       // address(0) if unused\n'
    '    start,               // 0\n'
    '    end                  // 10\n'
    ')  // Returns PositionInfo[] with P&L, fees, liq price\n'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 5: ONE-CLICK TRADING (GMX EXPRESS)
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('5. One-Click Trading (GMX Express) Integration'))

story.append(H2('5.1 Why One-Click Trading Matters for EasyGMX'))

story.append(P(
    'The single biggest UX improvement EasyGMX can offer over the standard GMX interface is eliminating the MetaMask popup '
    'for every trade. GMX Express (one-click trading) uses a delegated subaccount architecture powered by Gelato Relay '
    'to enable gasless, signature-free trading after an initial one-time setup. For EasyGMX, this is not a nice-to-have; '
    'it is essential. The entire value proposition of a "click and watch" experience is destroyed if the user must '
    'approve a MetaMask transaction every time they open or close a position. With one-click trading, the flow becomes: '
    'click "Open Trade" and the position starts opening immediately. No popup, no gas, no friction.'
))

story.append(H2('5.2 How GMX Express Works'))

story.append(P(
    'GMX Express uses a subaccount architecture where the main account owner authorizes a delegated signer. This delegated '
    'signer can create, update, and cancel orders on behalf of the owner without requiring the owner to sign each transaction '
    'individually. The Gelato Relay network handles transaction submission, and gas fees are paid from the user account '
    'via Gelato 1Balance, supporting USDC, WETH, and other tokens as gas payment. The security model is enforced by '
    'three constraints: the subaccount can only manage orders (it cannot deposit, withdraw, shift, or claim funds), '
    'access expires based on a configurable timestamp, and the total number of delegated actions is capped by a maximum '
    'action count that requires re-authorization when exceeded.'
))

story.append(H2('5.3 One-Time Setup Flow'))

story.append(P(
    'Before a user can trade gaslessly on EasyGMX, they must complete a one-time activation. This involves connecting '
    'their wallet, signing an EIP-712 message that authorizes a delegated subaccount, and optionally configuring limits '
    'such as expiry timestamp and maximum action count. The entire setup is a single wallet signature, after which all '
    'subsequent trades on EasyGMX are gasless and require no further wallet interactions.'
))

setup_headers = ['Step', 'Action', 'Wallet Interaction']
setup_rows = [
    ['1', 'Connect wallet to EasyGMX', 'MetaMask connection prompt'],
    ['2', 'Sign EIP-712 authorization message', 'One signature required'],
    ['3', 'Subaccount is generated and authorized', 'Automatic, no user action'],
    ['4', 'All future trades are gasless', 'No more wallet popups for trades'],
]
story.append(Spacer(1, 6))
story.append(make_table(setup_headers, setup_rows, [0.08, 0.52, 0.40]))
story.append(CAPTION('Table 6: One-click trading setup flow'))
story.append(Spacer(1, 12))

story.append(H2('5.4 Integration via GMX SDK v2'))

story.append(P(
    'The GMX SDK v2 provides built-in support for one-click trading through the GmxApiSdk class. The recommended '
    'integration path for EasyGMX is to use the SDK rather than calling the SubaccountGelatoRelayRouter contract directly, '
    'because the SDK handles signature generation, relay fee estimation, and order submission in a single workflow. '
    'The key methods are generateSubaccount (to derive the delegated signer from the main wallet), activateSubaccount '
    '(to sign and store the authorization), executeExpressOrder (to prepare, sign, and submit an order in one call), '
    'and fetchOrderStatus (to track whether the keeper has executed the order).'
))

story.append(CODE(
    '// GMX SDK v2 integration pattern\n'
    'import { GmxApiSdk } from "@gmx-io/sdk/v2";\n'
    '\n'
    'const apiSdk = new GmxApiSdk({ chainId: 42161 });\n'
    '\n'
    '// One-time: activate subaccount for gasless trading\n'
    'const subaccount = apiSdk.generateSubaccount(mainSigner);\n'
    'await apiSdk.activateSubaccount(mainSigner, {\n'
    '    expiresAt: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days\n'
    '    maxActionCount: 1000  // Re-authorize after 1000 trades\n'
    '});\n'
    '\n'
    '// Open a position (gasless, no MetaMask popup)\n'
    'const result = await apiSdk.executeExpressOrder({\n'
    '    market: "0x...BTC_USD",\n'
    '    side: "long",\n'
    '    collateralToken: USDC_ADDRESS,\n'
    '    collateralDeltaAmount: parseUnits("10", 6),  // $10 USDC\n'
    '    sizeDeltaUsd: parseUnits("50", 30),           // $50 position (5x)\n'
    '    orderType: "market_increase",\n'
    '    acceptablePrice: currentPrice * 1.005,         // 0.5% slippage\n'
    '}, mainSigner);\n'
    '\n'
    '// Check order status (poll while keeper executes)\n'
    'const status = await apiSdk.fetchOrderStatus({\n'
    '    requestId: result.requestId\n'
    '});\n'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 6: FRONTEND TECHNICAL STACK
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('6. Frontend Technical Stack and Development'))

story.append(H2('6.1 Technology Choices'))

tech_headers = ['Layer', 'Technology', 'Rationale']
tech_rows = [
    ['Framework', 'Next.js 14+ (App Router)',
     'React SSR for fast initial load, API routes for optional backend needs'],
    ['Styling', 'Tailwind CSS',
     'Utility-first, rapid prototyping, consistent design tokens'],
    ['Wallet', 'wagmi v2 + RainbowKit',
     'Industry standard, handles MetaMask/Rabby/WalletConnect'],
    ['Blockchain', 'viem (preferred) or ethers.js v6',
     'TypeScript-native, lighter than ethers.js, GMX SDK uses viem'],
    ['State', 'Zustand',
     'Lightweight, no boilerplate, perfect for position/P&L tracking'],
    ['Charts', 'lightweight-charts (TradingView)',
     'Same charting library GMX uses, familiar to traders'],
    ['SDK', '@gmx-io/sdk v2 (GmxApiSdk)',
     'Official GMX SDK with Express order support'],
    ['Deployment', 'Vercel (free tier)',
     'Zero-config Next.js deployment, automatic HTTPS'],
]
story.append(Spacer(1, 6))
story.append(make_table(tech_headers, tech_rows, [0.13, 0.27, 0.60]))
story.append(CAPTION('Table 7: Frontend technology stack'))
story.append(Spacer(1, 12))

story.append(H2('6.2 Project Structure'))

story.append(CODE(
    'easygmx/\n'
    '  app/\n'
    '    layout.tsx          # Root layout with wagmi/RainbowKit providers\n'
    '    page.tsx            # Screen 1: Landing / Connect\n'
    '    trade/\n'
    '      page.tsx          # Screen 2: Market Select\n'
    '      [market]/\n'
    '        page.tsx        # Screen 3: Trade Setup\n'
    '    position/\n'
    '      [key]/\n'
    '        page.tsx        # Screen 4: Position Live\n'
    '  components/\n'
    '    MarketCard.tsx      # Coin selection card with live price\n'
    '    DirectionButton.tsx # Up/Down toggle\n'
    '    AmountInput.tsx     # USDC amount with preset buttons\n'
    '    LeverageSelector.tsx # 5x / 10x toggle\n'
    '    FeeDisplay.tsx      # Fee breakdown with info button\n'
    '    PositionCard.tsx    # Live P&L display with TP/SL\n'
    '    PriceChart.tsx      # Lightweight TradingView chart\n'
    '    OrderStatus.tsx     # Keeper waiting state indicator\n'
    '  hooks/\n'
    '    useGmxPosition.ts   # Read and poll GMX position data\n'
    '    useGmxMarkets.ts    # Fetch market list and prices\n'
    '    useGmxOrder.ts      # Submit and track orders\n'
    '    useOneClick.ts      # Manage 1CT activation state\n'
    '  lib/\n'
    '    gmx-contracts.ts    # Contract addresses and ABIs\n'
    '    gmx-order.ts        # Order building and submission logic\n'
    '    gmx-reader.ts       # Position and market data queries\n'
    '    gmx-express.ts      # One-click trading integration\n'
    '    price-feed.ts       # Real-time price subscription\n'
    '    pnl-calculator.ts   # Client-side P&L computation\n'
    '  providers/\n'
    '    Web3Provider.tsx    # wagmi + RainbowKit + GMX SDK config\n'
    '  public/\n'
    '    icons/             # Coin icons, logo assets\n'
))

story.append(H2('6.3 Key Frontend Challenges'))

story.append(P(
    '<b>Challenge 1: Keeper Delay UX.</b> The 2-10 second keeper delay is the biggest UX challenge. During this window, '
    'the user has already clicked "Open Trade" but the position is not yet live. The price may have moved since they '
    'clicked. The solution is a clear "Position opening..." state on Screen 4, with a pulsing animation and a countdown '
    'that shows the order is being processed. The app polls the GMX API fetchOrderStatus endpoint every 2 seconds until '
    'the order is either executed or cancelled.'
))

story.append(P(
    '<b>Challenge 2: Slippage Management.</b> The user sees a price of $97,234 when they click "Open Trade," but the keeper '
    'executes at $97,287. The app sets an acceptablePrice with 0.5% slippage tolerance by default. If the keeper cannot '
    'execute within this range, the order is cancelled and the app shows a simple "Price moved too much, try again" message. '
    'The user never sees technical terms like "slippage" or "acceptable price."'
))

story.append(P(
    '<b>Challenge 3: Real-Time P&amp;L Updates.</b> The P&L counter must update every 1-5 seconds to create the "Aviator feel." '
    'This is achieved by polling the GMX REST API market tickers endpoint or by listening to oracle price update events '
    'via the Reader contract. The P&L is calculated client-side as: P&amp;L = (currentPrice - entryPrice) x positionSize x '
    'direction - cumulativeBorrowFee - cumulativeFundingFee. The Reader contract enriched position data also provides '
    'a server-calculated P&amp;L that can be used as a verification check.'
))

story.append(P(
    '<b>Challenge 4: Mobile-First Design.</b> GMX existing mobile experience is functional but dense. EasyGMX should be '
    'built mobile-first from day one. Large touch targets (minimum 44px), simple layouts that stack vertically, and no '
    'horizontal scrolling. The four-screen architecture naturally maps to a vertical scrolling experience on mobile.'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 7: GMX REST API REFERENCE
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('7. GMX REST API and Data Endpoints'))

story.append(P(
    'GMX provides two API versions for reading market data and managing orders. The v1 API is stable and provides '
    'oracle prices and market information. The v2 API is expanding and adds full read/write capabilities including '
    'Express order submission. Both APIs are publicly accessible and require no authentication. The recommended approach '
    'for EasyGMX is to use the v2 API for all data needs, falling back to direct contract reads via the Reader contract '
    'when the API is unavailable or stale.'
))

api_headers = ['Endpoint', 'Method', 'Usage in EasyGMX']
api_rows = [
    ['/markets', 'GET', 'Load the 4 target markets and their addresses'],
    ['/markets/tickers', 'GET', 'Real-time price feed for charts and P&L'],
    ['/tokens/info', 'GET', 'USDC balance and allowance checks'],
    ['/positions?address=X', 'GET', 'Load user open positions for Screen 4'],
    ['/orders?address=X', 'GET', 'Check pending orders during keeper wait'],
    ['/orders/txns/submit', 'POST', 'Submit signed Express orders (1CT)'],
    ['/orders/txns/status', 'GET', 'Poll order execution status during keeper wait'],
    ['/prices/ohlcv', 'GET', 'Historical price data for chart rendering'],
    ['/rates', 'GET', 'Current funding and borrow rates for fee display'],
]
story.append(Spacer(1, 6))
story.append(make_table(api_headers, api_rows, [0.22, 0.10, 0.68]))
story.append(CAPTION('Table 8: GMX REST API v2 endpoints used by EasyGMX'))
story.append(Spacer(1, 12))

story.append(P(
    'The base URLs for the v2 API are https://arbitrum.gmxapi.io/v1 and https://arbitrum.gmxapi.ai/v1. These are two '
    'independent peers with equal priority, and the app should implement failover between them. The v1 API at '
    'https://arbitrum-api.gmxinfra.io is also available as a fallback for market data reads. All endpoints are cached: '
    'market catalog is cached for 60 seconds, while ticker data (prices) is cached for only 1 second, making it suitable '
    'for near-real-time P&L display.'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 8: SAFETY & SECURITY
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('8. Safety and Security Architecture'))

story.append(H2('8.1 Why EasyGMX Cannot Lose User Funds'))

story.append(P(
    'The most critical safety property of EasyGMX is that it never holds, controls, or has access to user funds. '
    'This is not a design choice; it is a structural consequence of the architecture. EasyGMX is a frontend that builds '
    'transactions for the user wallet to sign and submit. The smart contracts that hold funds (GMX OrderVault, position '
    'contracts) are deployed and audited by GMX. EasyGMX cannot modify these contracts, cannot redirect funds, and cannot '
    'access user collateral. The only thing EasyGMX code does is construct the parameters for a createOrder call and pass '
    'them to the wallet for signing.'
))

story.append(callout_box(
    '<b>Safety Principle:</b> EasyGMX is like a remote control for a TV. It sends signals (transaction parameters), '
    'but the TV (GMX smart contracts) does all the actual work. If the remote control breaks, the TV still works fine. '
    'If someone hacks the remote control, they can only send signals that the TV would accept anyway; they cannot '
    'open the TV and take the components out.'
))
story.append(Spacer(1, 12))

story.append(H2('8.2 Risk Assessment'))

risk_headers = ['Risk', 'Severity', 'Mitigation']
risk_rows = [
    ['Wrong P&L display', 'Low',
     'Add "P&L is estimated" disclaimer; link to GMX for verification; use Reader contract for data'],
    ['Wrong order parameters', 'Medium',
     'Display all parameters in confirmation step before signing; use GMX SDK validated builders'],
    ['Subaccount compromise', 'Medium',
     'Subaccount scope limited to order management only; no deposit/withdraw/claim capability; user can revoke anytime'],
    ['Frontend tampering (XSS)', 'Medium',
     'Content Security Policy headers; no external script loading; open source for audit'],
    ['API endpoint down', 'Low',
     'Fallback to direct contract reads via RPC; multiple API peers with failover'],
    ['GMX contract upgrade', 'Low',
     'Contract addresses fetched from SDK/config, not hardcoded; monitor GMX governance for upgrade announcements'],
]
story.append(Spacer(1, 6))
story.append(make_table(risk_headers, risk_rows, [0.25, 0.12, 0.63]))
story.append(CAPTION('Table 9: Risk assessment and mitigation strategies'))
story.append(Spacer(1, 12))

story.append(H2('8.3 Regulatory Position'))

story.append(P(
    'EasyGMX is a frontend interface to an existing decentralized protocol, not a financial intermediary. It does not '
    'hold user funds, does not execute trades (GMX keepers do), does not set prices (GMX oracles do), and does not '
    'provide investment advice. The legal position is the same as any DeFi frontend: the interface is a tool, not a '
    'service provider. However, the simplified UI and real-time P&L display could attract regulatory scrutiny if it '
    'is perceived as gambling. To maintain a defensible regulatory position, EasyGMX must never use gambling language '
    '("game," "bet," "win"), must always display that positions are real leveraged trades with real risk, must include '
    'risk warnings, and must not add leaderboards, achievements, or other gamification mechanics.'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 9: DEVELOPMENT PHASES & TIMELINE
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('9. Development Phases and Timeline'))

story.append(P(
    'The development plan is structured into six phases, progressing from a static prototype that costs nothing to build, '
    'through a read-only MVP that validates the data integration, to a full trading application with one-click trading. '
    'The timeline assumes a solo developer who is learning blockchain interaction as they go. An experienced React developer '
    'who already knows ethers.js/viem could complete the project in roughly half the estimated time.'
))

story.append(H2('Phase 1: Static Prototype (Weeks 1-2)'))

story.append(P(
    'The goal of Phase 1 is to validate the concept with the GMX community before writing any blockchain code. This phase '
    'produces a clickable prototype with hardcoded data that demonstrates the four-screen user flow. The prototype can be '
    'shared as a link in GMX Discord or Telegram for feedback. No wallet connection, no real trades, no blockchain. '
    'Just UI components with mock data that looks and feels like the final product.'
))

p1_headers = ['Task', 'Details', 'Time']
p1_rows = [
    ['Design 4 screens in Figma', 'Screen layouts, color system, typography', '3 days'],
    ['Build static Next.js pages', 'React components with hardcoded mock data', '4 days'],
    ['Add animations and transitions', 'Price ticker animation, P&L counter, loading states', '3 days'],
    ['Share with GMX community', 'Post in Discord/Telegram, collect feedback', 'Ongoing'],
]
story.append(Spacer(1, 6))
story.append(make_table(p1_headers, p1_rows, [0.30, 0.52, 0.18]))
story.append(Spacer(1, 12))

story.append(H2('Phase 2: Read-Only MVP (Weeks 3-5)'))

story.append(P(
    'Phase 2 connects the prototype to real GMX data. The user can connect their wallet and see their existing GMX '
    'positions displayed in the EasyGMX interface, but cannot open or close trades yet. This phase validates the data '
    'integration layer: wallet connection, position reading, price feeds, and P&L calculation. If the P&L numbers match '
    'what GMX shows, the data layer is correct.'
))

p2_headers = ['Task', 'Details', 'Time']
p2_rows = [
    ['Set up wagmi + RainbowKit', 'Wallet connection, network switching', '2 days'],
    ['Integrate GMX REST API v2', 'Markets, tickers, positions endpoints', '3 days'],
    ['Build useGmxPosition hook', 'Read positions via Reader contract', '3 days'],
    ['Build PriceChart component', 'lightweight-charts with real price data', '3 days'],
    ['Calculate and display real-time P&L', 'Client-side P&L with oracle price polling', '3 days'],
    ['Test against GMX UI', 'Verify P&L numbers match GMX dashboard', '2 days'],
]
story.append(Spacer(1, 6))
story.append(make_table(p2_headers, p2_rows, [0.30, 0.52, 0.18]))
story.append(Spacer(1, 12))

story.append(H2('Phase 3: Trading Functionality (Weeks 6-9)'))

story.append(P(
    'Phase 3 implements the core trading functionality. Users can open and close positions through EasyGMX using the '
    'classic multicall pattern (with MetaMask popup for each trade). This is the hardest phase because it involves '
    'building correct order parameters, handling the two-phase keeper execution, and managing all the edge cases '
    '(rejected orders, slippage, gas estimation, collateral approvals). The app must be tested on Arbitrum Sepolia '
    'testnet before any mainnet deployment.'
))

p3_headers = ['Task', 'Details', 'Time']
p3_rows = [
    ['Build USDC approval flow', 'ERC-20 approve for GMX OrderVault', '1 day'],
    ['Implement createOrder multicall', 'sendWnt + sendTokens + createOrder', '4 days'],
    ['Implement MarketDecrease close', 'Position closing with Take Profit / Cut Loss', '3 days'],
    ['Build OrderStatus component', 'Keeper waiting state with polling', '3 days'],
    ['Handle edge cases', 'Rejected orders, insufficient balance, gas estimation', '3 days'],
    ['Testnet deployment and testing', 'Arbitrum Sepolia with test USDC', '4 days'],
    ['Mainnet deployment (limited beta)', 'Small group of testers, $10 max position', '2 days'],
]
story.append(Spacer(1, 6))
story.append(make_table(p3_headers, p3_rows, [0.30, 0.52, 0.18]))
story.append(Spacer(1, 12))

story.append(H2('Phase 4: One-Click Trading Integration (Weeks 10-12)'))

story.append(P(
    'Phase 4 replaces the MetaMask popup flow with GMX Express one-click trading. This is the single biggest UX '
    'improvement and transforms EasyGMX from a simplified GMX wrapper into a truly frictionless trading experience. '
    'The implementation uses the GMX SDK v2 executeExpressOrder method, which handles subaccount generation, '
    'authorization signing, and gasless order submission in a single workflow.'
))

p4_headers = ['Task', 'Details', 'Time']
p4_rows = [
    ['Integrate GMX SDK v2', 'GmxApiSdk setup and configuration', '2 days'],
    ['Build 1CT activation flow', 'One-time subaccount setup screen', '3 days'],
    ['Replace multicall with executeExpressOrder', 'Gasless order submission via Gelato Relay', '3 days'],
    ['Build order status polling', 'fetchOrderStatus loop during keeper wait', '2 days'],
    ['Test gasless flow end-to-end', 'Verify no ETH needed, USDC fee deduction', '2 days'],
]
story.append(Spacer(1, 6))
story.append(make_table(p4_headers, p4_rows, [0.35, 0.47, 0.18]))
story.append(Spacer(1, 12))

story.append(H2('Phase 5: Polish and Differentiation (Weeks 13-15)'))

story.append(P(
    'Phase 5 focuses on the features that differentiate EasyGMX from simply using GMX directly. These features are '
    'not essential for the core trading functionality, but they create the "stickiness" that keeps users coming back. '
    'Push notifications for P&L milestones, a clean trade history, and a bridge to the full GMX UI for advanced users '
    'are the key deliverables.'
))

p5_headers = ['Task', 'Details', 'Time']
p5_rows = [
    ['Mobile optimization', 'Touch targets, responsive layout, PWA support', '3 days'],
    ['Push notifications', 'P&L milestone alerts via Web Push API', '3 days'],
    ['Trade history / journal', 'Simple list of past trades with P&L', '3 days'],
    ['"Try GMX Advanced" bridge', 'Link to full GMX UI with educational tooltip', '1 day'],
    ['Success screenshot sharing', 'Generate shareable image of winning trade', '2 days'],
    ['Code quality review', 'Clean up AI-generated code, add documentation', '3 days'],
]
story.append(Spacer(1, 6))
story.append(make_table(p5_headers, p5_rows, [0.30, 0.52, 0.18]))
story.append(Spacer(1, 12))

story.append(H2('Phase 6: Community and GMX Integration (Weeks 16+)'))

story.append(P(
    'Phase 6 is about getting the product into the hands of the GMX community and exploring paths to official adoption. '
    'This includes publishing the open-source repository, presenting to the GMX community, and potentially submitting '
    'a governance proposal for GMX to integrate the simplified UI natively or fund its continued development.'
))

p6_headers = ['Task', 'Details', 'Time']
p6_rows = [
    ['Open source repository', 'Publish on GitHub with clean code and README', '2 days'],
    ['Community demo', 'Present in GMX Discord, gather feedback', 'Ongoing'],
    ['Governance proposal (optional)', 'Draft proposal for GMX to adopt or fund EasyGMX', '5 days'],
    ['Iterate based on feedback', 'Bug fixes, feature requests, UX improvements', 'Ongoing'],
]
story.append(Spacer(1, 6))
story.append(make_table(p6_headers, p6_rows, [0.30, 0.52, 0.18]))
story.append(Spacer(1, 12))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 10: TECHNICAL LEARNING PATH
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('10. Technical Learning Path'))

story.append(P(
    'The developer has existing React and JavaScript knowledge but is new to blockchain development. The following '
    'learning path is structured to deliver the minimum viable knowledge needed for each development phase, so that '
    'learning happens in parallel with building rather than as a prerequisite.'
))

learn_headers = ['Week', 'Topic', 'Resources', 'Deliverable']
learn_rows = [
    ['1-2', 'Next.js 14 App Router basics',
     'Next.js docs, Tailwind CSS docs', 'Static prototype (Phase 1)'],
    ['3', 'wagmi v2 + viem fundamentals',
     'wagmi docs, viem docs, RainbowKit setup guide', 'Wallet connection working'],
    ['4', 'GMX V2 architecture deep dive',
     'GMX docs, gmx-synthetics GitHub, contract addresses', 'Read positions via Reader'],
    ['5', 'ERC-20 approvals and multicall pattern',
     'ethers.js/viem guides, GMX createOrder examples', 'USDC approval flow working'],
    ['6-7', 'Building and submitting orders',
     'GMX SDK docs, OrderHandler source code', 'Open position on testnet'],
    ['8-9', 'Testnet testing and edge cases',
     'Arbitrum Sepolia faucet, GMX testnet UI', 'Reliable open/close flow'],
    ['10-11', 'GMX Express / One-Click Trading',
     'GMX delegated trading docs, Gelato Relay docs', 'Gasless trading working'],
    ['12+', 'Advanced features and polish',
     'Web Push API, PWA docs, open source best practices', 'Feature-complete app'],
]
story.append(Spacer(1, 6))
story.append(make_table(learn_headers, learn_rows, [0.07, 0.22, 0.38, 0.33]))
story.append(CAPTION('Table 10: Week-by-week learning path aligned to development phases'))
story.append(Spacer(1, 12))

story.append(callout_box(
    '<b>Key Insight:</b> You do NOT need to learn Solidity, smart contract development, or blockchain consensus. '
    'The only blockchain-specific knowledge required is: (1) how to connect a wallet via wagmi, (2) how to call '
    'read functions on a contract via viem/ethers, and (3) how to build and submit a createOrder transaction. '
    'Everything else is standard React/Next.js frontend development.'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 11: OPEN SOURCE & COMMUNITY STRATEGY
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('11. Open Source and Community Strategy'))

story.append(H2('11.1 Code Quality Standards'))

story.append(P(
    'Because the developer is using AI assistance for code generation, special attention must be paid to code quality. '
    'The goal is for the repository to look like it was written by an experienced developer, not like AI-generated boilerplate. '
    'This means: consistent naming conventions, clear component structure, proper TypeScript types, no unused imports or '
    'variables, meaningful commit messages, and comprehensive README documentation. Before publishing the repository, '
    'every file should be reviewed and cleaned up. AI can generate the initial code quickly, but the human must review '
    'and refine it to production quality.'
))

story.append(H2('11.2 Open Source Licensing'))

story.append(P(
    'The recommended license is MIT, which is the most permissive and most common in the Ethereum/DeFi ecosystem. '
    'This signals to GMX that the project is built for the community, not for extraction. If GMX wants to incorporate '
    'the code into their own UI, the MIT license allows them to do so without restriction. The only requirement is '
    'attribution, which benefits the developer by ensuring their contribution is recognized.'
))

story.append(H2('11.3 Community Engagement Plan'))

story.append(P(
    'The GMX community is small but active and helpful. The engagement plan follows a graduated approach: first share '
    'the static prototype in GMX Discord for early feedback, then invite community members to test the read-only MVP, '
    'then open a limited beta for trading functionality, and finally present the full product to the GMX team. '
    'If the community response is positive, the next step is a governance proposal on the GMX forum proposing that '
    'GMX either integrate the simplified UI natively, fund its continued development through a grant, or hire the '
    'developer as a contributor to build and maintain it as an official GMX product.'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 12: RISK ASSESSMENT
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('12. Risk Assessment and Mitigation'))

story.append(H2('12.1 Strategic Risks'))

story.append(P(
    '<b>GMX builds their own simplified mode.</b> If GMX develops a native "Easy Mode," the independent EasyGMX project '
    'becomes redundant. Mitigation: build for GMX, not against GMX. Frame the project as a contribution to the ecosystem '
    'from day one. If GMX builds their own simplified UI, the developer can offer to help improve it, having demonstrated '
    'competence through the EasyGMX project.'
))

story.append(P(
    '<b>User acquisition failure.</b> Building the product is only half the challenge; getting people to use it is equally '
    'difficult. The target audience of GMX holders who do not trade is small and hard to reach. Mitigation: leverage the '
    'GMX community directly. Post demos in Discord, share on Twitter/X with the GMX hashtag, and ask community members '
    'to try the product and provide feedback. The open-source nature of the project also means that any GMX community '
    'member can share and promote it.'
))

story.append(P(
    '<b>Regulatory scrutiny.</b> A simplified trading interface that feels like a game could attract unwanted attention '
    'from regulators, even if the underlying trades are legitimate. Mitigation: never use gambling language, always show '
    'that positions are real trades with real risk, include prominent risk warnings, and do not add gamification mechanics. '
    'The regulatory position is defensible because EasyGMX is a frontend interface, not a financial service provider.'
))

story.append(H2('12.2 Technical Risks'))

story.append(P(
    '<b>GMX contract upgrades break the integration.</b> GMX logic contracts (ExchangeRouter, Reader, OrderHandler) can '
    'be upgraded. An upgrade could change function signatures or parameter formats, breaking the EasyGMX integration. '
    'Mitigation: use the GMX SDK rather than calling contracts directly, as the SDK is maintained by GMX and will be '
    'updated to reflect contract changes. Store contract addresses in a configuration file rather than hardcoding them, '
    'and monitor GMX governance announcements for upcoming upgrades.'
))

story.append(P(
    '<b>Keeper delays during high volatility.</b> During periods of extreme market volatility, keeper delays can extend '
    'from the typical 2-10 seconds to 30+ seconds. This degrades the user experience and can cause orders to be rejected '
    'due to price movement beyond the acceptable slippage range. Mitigation: the app should detect high volatility '
    'conditions (large price swings in short periods) and display a warning to the user: "Market is highly volatile. '
    'Orders may take longer to execute and prices may change significantly." Optionally, the app could disable trading '
    'during extreme volatility, though this must be carefully communicated to avoid user frustration.'
))

story.append(P(
    '<b>Gelato Relay downtime.</b> If Gelato Relay experiences downtime, one-click trading will not work. Mitigation: '
    'implement a fallback to the classic multicall pattern (with MetaMask popup) when the Express flow fails. The app '
    'should detect the failure and present a clear message: "One-click trading is temporarily unavailable. You can still '
    'trade using the standard method, which requires a wallet confirmation for each trade."'
))

# ═══════════════════════════════════════════════════════════════════════
# SECTION 13: SUCCESS METRICS
# ═══════════════════════════════════════════════════════════════════════
story.append(H1('13. Success Metrics'))

story.append(P(
    'Defining clear success metrics is essential for knowing whether the project is achieving its goals. The metrics '
    'are organized into three tiers: the minimum viable outcome that makes the project worthwhile, the target outcome '
    'that would validate the concept, and the stretch outcome that could lead to a career in crypto.'
))

metrics_headers = ['Tier', 'Metric', 'Definition']
metrics_rows = [
    ['Minimum', 'Working prototype shared', 'Phase 1 complete, community has seen and commented on the UI'],
    ['Minimum', 'One user completes a trade', 'At least one person uses EasyGMX to open and close a real GMX position'],
    ['Target', '10+ weekly active users', 'At least 10 people per week using EasyGMX to trade on GMX'],
    ['Target', 'GMX team acknowledges project', 'A GMX contributor or team member publicly recognizes EasyGMX'],
    ['Target', 'Positive community feedback', 'Majority of GMX community responses are encouraging'],
    ['Stretch', 'GMX governance proposal', 'A formal proposal for GMX to adopt or fund EasyGMX development'],
    ['Stretch', 'Hired by GMX', 'Developer joins GMX as a contributor or team member'],
]
story.append(Spacer(1, 6))
story.append(make_table(metrics_headers, metrics_rows, [0.12, 0.28, 0.60]))
story.append(CAPTION('Table 11: Success metrics by tier'))
story.append(Spacer(1, 12))

story.append(callout_box(
    '<b>Remember:</b> The ultimate goal is not to build a profitable standalone product. The goal is to demonstrate '
    'value to the GMX ecosystem and find a path to working in crypto. If GMX adopts the simplified UI concept, even '
    'without the EasyGMX code, the project has succeeded. The code is the proof of concept; the relationship with GMX '
    'is the real deliverable.'
))

# ═══════════════════════════════════════════════════════════════════════
# BUILD THE DOCUMENT
# ═══════════════════════════════════════════════════════════════════════
doc.multiBuild(story)

print(f"PDF generated successfully: {output_path}")
print(f"Pages: approximately 15-18")
