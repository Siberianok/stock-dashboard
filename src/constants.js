export const COLORS = {
  baseBg: "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800",
  glass: "bg-white/10 ring-1 ring-white/15 backdrop-blur",
  badgeOK: "bg-emerald-100 text-emerald-700",
  badgeNO: "bg-rose-100 text-rose-700",
  gradientBar: "bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500",
  scoreHi: "#10b981",
  scoreMid: "#f59e0b",
  scoreLo: "#ef4444",
  link: "#38bdf8",
};

export const MARKETS = {
  US: { label: "EEUU", currency: "USD" },
  AR: { label: "Argentina", currency: "ARS" },
  BR: { label: "Brasil", currency: "BRL" },
  EU: { label: "Europa", currency: "EUR" },
  CN: { label: "China", currency: "CNY" },
};

export const UNIVERSE = {
  US: [
    "AAPL","TSLA","NVDA","AMD","MARA","PLTR","SOFI","IONQ","CAVA","AFRM",
    "RIVN","LCID","AI","UPST","DKNG","SNOW","COIN","SMCI","CRWD","ABNB",
    "ROKU","SHOP","NET","HOOD","RBLX","PATH","MDB","ZS","TTD","BABA",
  ],
  AR: [
    "GGAL.BA","PAMP.BA","YPFD.BA","BMA.BA","CEPU.BA","TGSU2.BA","ALUA.BA","TXAR.BA","COME.BA","SUPV.BA",
  ],
  BR: [
    "PETR4.SA","VALE3.SA","B3SA3.SA","ITUB4.SA","ABEV3.SA","BBAS3.SA","JBSS3.SA","WEGE3.SA","RENT3.SA","RADL3.SA",
  ],
  EU: [
    "AIR.PA","MC.PA","OR.PA","NESN.SW","SAP.DE","DTE.DE","ASML.AS","SIE.DE","RMS.PA","IBE.MC",
  ],
  CN: [
    "BABA","PDD","JD","NIO","LI","XPENG","BIDU","TME","BILI","NTES",
  ],
};

export const REQUIRED_FLAGS = ["priceOK","emaOK","rvol2","chgOK","atrOK","float50","rot1","shortOK","spreadOK","liqOK"];
