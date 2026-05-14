// Coffee Lab — custom "lab-inspired" line-art icons
// Style: thin strokes, geometric, with subtle lab/scientific cues (flasks, droplets, measurement marks)
// All icons inherit currentColor

const IconBase = ({ children, size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
       stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

// 1. القهوة — flask cup with steam ribbon
const IconCoffee = (p) => (
  <IconBase {...p}>
    <path d="M14 18h18v10a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8V18Z" />
    <path d="M32 21h3a4 4 0 0 1 0 8h-3" />
    <path d="M18 9c-1 2 1 3 0 5M24 9c-1 2 1 3 0 5M30 9c-1 2 1 3 0 5" />
    <circle cx="24" cy="27" r="1" fill="currentColor" stroke="none"/>
  </IconBase>
);

// 2. المشروبات الساخنة — mug with thermometer steam
const IconHotDrinks = (p) => (
  <IconBase {...p}>
    <path d="M12 16h20v12a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V16Z" />
    <path d="M32 19h3a3 3 0 0 1 0 6h-3" />
    <path d="M20 11v-3M24 11v-3M28 11v-3" />
  </IconBase>
);

// 3. المشروبات الباردة — tall glass with ice cubes
const IconColdDrinks = (p) => (
  <IconBase {...p}>
    <path d="M14 10h20l-2 28a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3L14 10Z" />
    <path d="M18 18h12" />
    <rect x="19" y="22" width="4" height="4" rx="0.5" />
    <rect x="25" y="28" width="4" height="4" rx="0.5" />
    <path d="M28 8v-2" />
  </IconBase>
);

// 4. الماتشا — bowl with whisk
const IconMatcha = (p) => (
  <IconBase {...p}>
    <path d="M8 22h32l-3 12a4 4 0 0 1-4 3H15a4 4 0 0 1-4-3L8 22Z" />
    <path d="M12 22l24-0" />
    <path d="M30 14v8M28 13l2 1 2-1M26 16l2-1 2 1 2-1 2 1" />
  </IconBase>
);

// 5. البروتين — shaker bottle with scoop measurement
const IconProtein = (p) => (
  <IconBase {...p}>
    <path d="M16 8h16v4l-2 2v22a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V14l-2-2V8Z" />
    <path d="M18 22h12M18 28h12" />
    <path d="M22 14h4" />
  </IconBase>
);

// 6. فرابتشينو — domed cup with cream swirl
const IconFrappuccino = (p) => (
  <IconBase {...p}>
    <path d="M14 20h20l-2 18a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3L14 20Z" />
    <path d="M14 20c0-6 4-10 10-10s10 4 10 10" />
    <path d="M20 16c1-2 2-2 4-2s3 0 4 2" />
    <path d="M28 7v3" />
  </IconBase>
);

// 7. الميلك شيك — coupe glass with cherry & straw
const IconMilkshake = (p) => (
  <IconBase {...p}>
    <path d="M14 16h20l-4 10a6 6 0 0 1-12 0L14 16Z" />
    <path d="M24 32v8M20 40h8" />
    <path d="M28 10l-2 6M30 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
  </IconBase>
);

// 8. السموذي — pear-shape blender jar with leaf
const IconSmoothie = (p) => (
  <IconBase {...p}>
    <path d="M18 14h12l-2 4c2 2 4 5 4 9v8a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-8c0-4 2-7 4-9l-2-4Z" />
    <path d="M24 8c2 0 4 1 4 4-2 0-4-1-4-4Z" />
    <path d="M20 28h8" />
  </IconBase>
);

// 9. العصائر الطازجة — citrus + droplet
const IconJuice = (p) => (
  <IconBase {...p}>
    <circle cx="24" cy="22" r="10" />
    <path d="M14 22h20M24 12v20M17 15l14 14M31 15 17 29" />
    <path d="M24 36c-2 2-2 4 0 6 2-2 2-4 0-6Z" fill="currentColor" stroke="none" opacity="0.9"/>
  </IconBase>
);

// 10. الكرواسون — crescent layered
const IconCroissant = (p) => (
  <IconBase {...p}>
    <path d="M10 28c2-12 12-20 24-18-2 12-12 20-24 18Z" />
    <path d="M14 26c2-8 8-14 16-14M17 28c2-6 7-11 14-11" />
  </IconBase>
);

// 11. الكوكيز — circle with chips dots
const IconCookies = (p) => (
  <IconBase {...p}>
    <circle cx="24" cy="24" r="14" />
    <circle cx="19" cy="20" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="28" cy="19" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="22" cy="28" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="30" cy="28" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="27" r="1.2" fill="currentColor" stroke="none"/>
  </IconBase>
);

// 12. المافن — fluted cup top swirl
const IconMuffin = (p) => (
  <IconBase {...p}>
    <path d="M14 24h20l-2 14a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3L14 24Z" />
    <path d="M14 24c0-6 4-10 10-10s10 4 10 10" />
    <path d="M18 24v14M24 24v17M30 24v14" />
    <path d="M22 11c1-2 3-2 4 0" />
  </IconBase>
);

// 13. دونات — torus with sprinkles
const IconDonut = (p) => (
  <IconBase {...p}>
    <circle cx="24" cy="24" r="14" />
    <circle cx="24" cy="24" r="5" />
    <path d="M16 17l1 2M30 16l-1 2M33 22l-2 0M18 30l1-1M30 31l-1-2" strokeWidth="1.6"/>
  </IconBase>
);

// 14. الكيك — layered cake with single candle
const IconCake = (p) => (
  <IconBase {...p}>
    <path d="M10 38h28v-12H10v12Z" />
    <path d="M12 26v-6a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v6" />
    <path d="M10 32h28" />
    <path d="M24 17v-5M22 8c0 2 2 2 2 4M24 8c2 2 0 2 0 4" />
  </IconBase>
);

// 15. الساندويشات — stacked layers with herb
const IconSandwich = (p) => (
  <IconBase {...p}>
    <path d="M8 18c4-6 12-8 16-8s12 2 16 8H8Z" />
    <path d="M8 18h32v4H8z" />
    <path d="M10 22c2 4 6 6 14 6s12-2 14-6" />
    <path d="M10 28h28v3H10z" />
    <path d="M16 14c1-1 2-1 3 0M26 12c1-1 2-1 3 0" />
  </IconBase>
);

// 16. السلطات — bowl with leaves
const IconSalad = (p) => (
  <IconBase {...p}>
    <path d="M8 22h32l-3 12a4 4 0 0 1-4 3H15a4 4 0 0 1-4-3L8 22Z" />
    <path d="M8 22h32" />
    <path d="M16 18c0-4 3-6 6-6 0 4-3 6-6 6Z" />
    <path d="M24 16c2-3 5-3 8-2-1 4-4 5-8 2Z" />
    <circle cx="20" cy="20" r="1.2" fill="currentColor" stroke="none"/>
  </IconBase>
);

const ICONS = {
  coffee: IconCoffee,
  hot: IconHotDrinks,
  cold: IconColdDrinks,
  matcha: IconMatcha,
  protein: IconProtein,
  frappuccino: IconFrappuccino,
  milkshake: IconMilkshake,
  smoothie: IconSmoothie,
  juice: IconJuice,
  croissant: IconCroissant,
  cookies: IconCookies,
  muffin: IconMuffin,
  donut: IconDonut,
  cake: IconCake,
  sandwich: IconSandwich,
  salad: IconSalad,
};

window.CLIcons = ICONS;
