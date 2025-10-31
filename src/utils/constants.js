export const COLORS = {
  baseBg: 'theme-app',
  glass: 'theme-glass',
  badgeOK: 'badge badge--ok',
  badgeNO: 'badge badge--ko',
  gradientBar: 'score-bar__fill',
  scoreHi: '#10b981',
  scoreMid: '#f59e0b',
  scoreLo: '#ef4444',
  link: '#38bdf8',
};

export const MARKETS = {
  US: { label: 'EEUU', currency: 'USD' },
  AR: { label: 'Argentina', currency: 'ARS' },
  BR: { label: 'Brasil', currency: 'BRL' },
  EU: { label: 'Europa', currency: 'EUR' },
  CN: { label: 'China', currency: 'CNY' },
};

export const UNIVERSE = {
  US: [
    'AAPL','TSLA','NVDA','AMD','MARA','PLTR','SOFI','IONQ','CAVA','AFRM',
    'RIVN','LCID','AI','UPST','DKNG','SNOW','COIN','SMCI','CRWD','ABNB',
    'ROKU','SHOP','NET','HOOD','RBLX','PATH','MDB','ZS','TTD','BABA',
  ],
  AR: [
    'GGAL.BA','PAMP.BA','YPFD.BA','BMA.BA','CEPU.BA','TGSU2.BA','ALUA.BA','TXAR.BA','COME.BA','SUPV.BA',
  ],
  BR: [
    'PETR4.SA','VALE3.SA','ITUB4.SA','BBDC4.SA','ABEV3.SA','BBAS3.SA','WEGE3.SA','B3SA3.SA','SUZB3.SA','LREN3.SA',
  ],
  EU: [
    'SIE.DE','ADS.DE','BMW.DE','AIR.PA','MC.PA','ASML.AS','NESN.SW','SAND.ST','IBE.MC','SAN.MC',
  ],
  CN: [
    '9988.HK','0700.HK','3690.HK','9618.HK','1810.HK','BIDU','PDD','JD','LI','NIO',
  ],
};

export const REQUIRED_FLAGS = ['priceOK','emaOK','rvol2','chgOK','atrOK','float50','rot1','shortOK','spreadOK','liqOK'];
