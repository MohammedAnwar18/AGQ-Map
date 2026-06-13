// =========================================================
//  ملف بيانات الجولات الافتراضية
// =========================================================
//  لإضافة موقع جديد: انسخ أحد الكائنات في TOUR_LOCATIONS وعدّل بياناته
//  لحذف موقع: احذف الكائن كاملاً من المصفوفة
//  لإضافة نقطة تصوير جديدة: أضف كائناً في مصفوفة panoramas الخاصة بالموقع
//  لإضافة سهم انتقال: أضف كائناً في مصفوفة hotspots الخاصة بالنقطة
//  direction: الاتجاه بالدرجات (0=شمال، 90=شرق، 180=جنوب، 270=غرب)
//  pitch: الميل العمودي (-90=أسفل، 0=أفق، 90=أعلى) - اختياري
//  image: ضع رابط صورة 360° بتنسيق equirectangular — أو اتركه null للمعاينة التجريبية
// =========================================================

export const TOUR_LOCATIONS = [
  {
    id: 'birzeit_university',
    name: 'جامعة بيرزيت',
    description: 'الحرم الجامعي الرئيسي',
    lat: 31.9580,
    lng: 35.1830,
    markerColor: '#6366f1',
    panoramas: [
      {
        id: 'main_gate',
        label: 'البوابة الرئيسية',
        image: null,
        hotspots: [
          { targetId: 'main_square', direction: 0, pitch: 0, label: 'الساحة الرئيسية' }
        ]
      },
      {
        id: 'main_square',
        label: 'الساحة الرئيسية',
        image: null,
        hotspots: [
          { targetId: 'main_gate', direction: 180, pitch: 0, label: 'البوابة الرئيسية' },
          { targetId: 'library',   direction: 90,  pitch: 0, label: 'المكتبة' }
        ]
      },
      {
        id: 'library',
        label: 'مكتبة الجامعة',
        image: null,
        hotspots: [
          { targetId: 'main_square', direction: 270, pitch: 0, label: 'الساحة الرئيسية' }
        ]
      }
    ]
  },
  {
    id: 'ramallah_city_center',
    name: 'وسط مدينة رام الله',
    description: 'قلب مدينة رام الله',
    lat: 31.9038,
    lng: 35.2034,
    markerColor: '#fbab15',
    panoramas: [
      {
        id: 'manara_square',
        label: 'دوار المنارة',
        image: null,
        hotspots: [
          { targetId: 'main_street', direction: 45, pitch: 0, label: 'الشارع الرئيسي' }
        ]
      },
      {
        id: 'main_street',
        label: 'الشارع الرئيسي',
        image: null,
        hotspots: [
          { targetId: 'manara_square', direction: 225, pitch: 0, label: 'دوار المنارة' }
        ]
      }
    ]
  },
  {
    id: 'birzeit_old_city',
    name: 'البلدة القديمة - بيرزيت',
    description: 'المباني التاريخية في قلب بيرزيت',
    lat: 31.9855,
    lng: 35.1913,
    markerColor: '#10b981',
    panoramas: [
      {
        id: 'old_market',
        label: 'السوق القديم',
        image: null,
        hotspots: [
          { targetId: 'heritage_street', direction: 90, pitch: 0, label: 'شارع التراث' }
        ]
      },
      {
        id: 'heritage_street',
        label: 'شارع التراث',
        image: null,
        hotspots: [
          { targetId: 'old_market', direction: 270, pitch: 0, label: 'السوق القديم' }
        ]
      }
    ]
  }
];
