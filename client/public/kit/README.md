# PalNovaa GIS Kit

طقم رموز وواجهات جاهز للجيوبورتال: **18 رمزاً نقطياً، 10 أنماط خطّية، 6 أنماط مساحية**، مكوّنات واجهة RTL بالوضعين، و3 قوالب صفحات كاملة. الهدف: أن يستدعي محرّك PalNovaa هذه الملفات بدل أن يعيد كتابتها في كل بناء.

## الملفات (ارفعها كما هي إلى R2)

| الملف | ما فيه |
|---|---|
| `kit/pn-ui-1.0.css` | الرموز (`--pn-*`) والمكوّنات `.pn-*` — RTL بخصائص منطقية، فاتح/داكن عبر `data-theme` |
| `kit/pn-icons-1.0.svg` | sprite واحد: 18 رمز معالم + 13 أيقونة واجهة (`pn-ui-*`)، اللون `currentColor` |
| `kit/pn-gis-1.0.js` | `window.PN`: الخريطة، الطبقات، الرموز، الأسطورة، النوافذ، الكوروبليث، تصدير CSV — وقيم كل الأنماط |
| `kit/pn-demo-1.0.js` | بيانات توضيحية مصطنعة للقوالب فقط — لا تُحمَّل في الإنتاج |
| `kit/templates/*.html` | ثلاثة قوالب: `geoportal-explorer` · `spatial-dashboard` · `feature-register` |

الإصدار في اسم كل ملف. أيّ تغيير يكسر الشكل = ملف جديد `-1.1`، والقديم يبقى منشوراً.

## مهم: الأيقونات عبر نطاق آخر

المتصفّحات **تمنع** `<use href="https://cdn…/pn-icons-1.0.svg#pn-mosque">` من نطاق مختلف حتى مع CORS مفتوح. لذلك: `PN.loadIcons(url)` يجلب الملف مرّة ويحقنه في الصفحة، وبعدها تكتب `<use href="#pn-mosque"/>` فقط.

## الرموز النقطية

دبوس 32×36 بلون الفئة، رمز أبيض بخط 1.8، حدّ أبيض 2px يفصله عن أيّ خريطة أساس. ألوان الدبابيس داكنة بما يكفي لتباين ≥3:1 مع الأبيض.

`pn-mosque` مسجد · `pn-church` كنيسة · `pn-supermarket` سوبرماركت · `pn-mall` مجمّع تجاري · `pn-hospital` مستشفى · `pn-park` حديقة · `pn-tower` برج اتصالات · `pn-police` مركز شرطة · `pn-checkpoint` حاجز / نقطة تفتيش · `pn-school` مدرسة · `pn-university` جامعة · `pn-bank` بنك · `pn-restaurant` مطعم · `pn-hookah` فيب وأراجيل · `pn-bakery` مخبز · `pn-butcher` ملحمة · `pn-traffic-light` إشارة مرور · `pn-camera` كاميرا مراقبة

## الأنماط الخطّية

كل نمط **مكدّس طبقات** يُرسم من الأسفل للأعلى: الحافة (casing) أولاً ثم القلب. التسلسل الهرمي للطرق بالعرض واللون معاً: سريع (أحمر 7/10) ← رئيسي (برتقالي 5.5/8) ← إقليمي (أصفر 4.5/7) ← فرعي (أبيض 3.5/5.5). الشبكات (كهرباء، مياه) خطوط رفيعة متقطّعة بنمطين مختلفين حتى تتميّز بالشكل لا باللون وحده.

`ln-motorway` شارع سريع · `ln-main` شارع رئيسي · `ln-regional` شارع إقليمي · `ln-local` شارع فرعي · `ln-railway` سكة قطار · `ln-wall` جدار الفصل العنصري · `ln-power` خط كهرباء · `ln-water` خط مياه · `ln-river` نهر / وادٍ · `ln-trail` مسار مشي

## الأنماط المساحية

الحدود الإدارية متقطّعة وتزداد سماكةً مع المستوى (قرية 1.5 ← مدينة 2.2 ← محافظة 3) وتعبئتها شبه شفافة كي لا تحجب ما تحتها. الأحواض متقطّعة أصفر-ذهبي، والقطع خطّ بنّي رفيع متّصل: تُقرأ القطعة داخل الحوض.

`pg-governorate` حدود محافظة · `pg-city` حدود مدينة · `pg-village` حدود قرية · `pg-water` مسطّح مائي · `pg-basin` حوض أراضٍ · `pg-parcel` قطعة أرض

## كتلة الحقن للمحرّك (انسخها كما هي)

هذا كل ما يحتاجه الموديل في تعليمات النظام — حوالي 450 رمزاً، تحت سقف 900:

```text
KIT=<R2>/kit/ — load: leaflet 1.9.4, pn-ui-1.0.css, pn-gis-1.0.js; then PN.loadIcons(KIT+'pn-icons-1.0.svg').
Map: m=PN.map(el,{center,zoom,basemap:'satellite|google|hybrid|osm'}) · PN.layer(url,{map:m,symbol:id|f=>id,status:'#s'}) fetch+loading/error+fit
Draw: PN.marker([lat,lng],'pn-*') · PN.line(geo,'ln-*') · PN.area(geo,'pg-*') · PN.choropleth(geo,{field,map}) · PN.legend([ids]) · PN.popup(props,title) · PN.exportCSV(rows,name)
Icon: <svg class="pn-i"><use href="#ID"/></svg> · PN.pin(id)
UI: .pn-app>.pn-head+.pn-side+.pn-main>.pn-map · .pn-float--ts|te|bs|be · .pn-card .pn-btn(--ghost|--icon|--sm) .pn-chip.is-on .pn-badge .pn-tabs>.pn-tab.is-on .pn-layer .pn-kpis>.pn-kpi .pn-table .pn-empty .pn-spinner .pn-status
Vars you may set: --pn-accent --pn-radius --pn-font --pn-side-w · theme: <html data-theme="dark">
Points: mosque church supermarket mall hospital park tower police checkpoint school university bank restaurant hookah bakery butcher traffic-light camera (prefix pn-)
Lines: motorway main regional local railway wall power water river trail (prefix ln-)
Areas: governorate city village water basin parcel (prefix pg-)
Never redraw icons, legends or popups by hand; never inline the sprite's paths.
```

## القياس

خذ نفس الطلب قبل الطقم وبعده وقارن «رموز الإخراج» في مقياس الأدمن. الهدف انخفاض ≥40%. إن لم يحدث: قلّص الكتلة أعلاه، لا توسّعها.

## قواعد الاستعمال

- لا يُعاد رسم أيّ رمز أو أسطورة أو نافذة يدوياً: `PN.marker` / `PN.legend` / `PN.popup`.
- يُسمح بتغيير `--pn-accent` و`--pn-radius` و`--pn-font` و`--pn-side-w` فقط، حتى لا تخرج كل التطبيقات بوجه واحد ولا تنكسر البنية.
- الخط: IBM Plex Sans Arabic من Google Fonts.
- نصوص الواجهة على `surface` بلون `ink` (تباين ≥4.5:1 في الوضعين).
