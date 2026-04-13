export type ScreenState =
  | 'menu'
  | 'devmenu'
  | 'playing'
  | 'levelup'
  | 'gameover'
  | 'metascreen'
  | 'paused'
  | 'cardbook';

export interface BtnRect {
  cx: number;
  cy: number;
  bw: number;
  bh: number;
}

export interface HoverRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  data: any;
}

export interface RuntimeUI {
  waveStartBtn: BtnRect | null;
  refreshAllBtn: BtnRect | null;
  continueBtn: BtnRect | null;
  rerollBtn: BtnRect | null;
  refreshShopBtn: BtnRect | null;
  menuBtns: BtnRect[];
  gameoverBtns: BtnRect[];
  pauseBtns: BtnRect[];
  cardBookScroll: number;
  cardBookBackBtn: BtnRect | null;
  metaBtns: any[];
  metaBackBtn: BtnRect | null;
  metaScroll: number;
  maxMetaScroll: number;
  devMenuBtns: any[];
}

export interface RuntimeDev {
  menuHoldStart: number;
  menuStatus: string;
  config: any;
}

export interface Runtime {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  mouseX: number;
  mouseY: number;
  mouseInside: boolean;
  hoverRegions: HoverRegion[];
  cam: { sx: number; sy: number };
  state: ScreenState;
  prevState: ScreenState;
  game: any;
  meta: any;
  lastTime: number;
  ui: RuntimeUI;
  dev: RuntimeDev;
}
