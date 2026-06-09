# مخططات سير العمل والعلاقات المكانية (Spatial Relationships Flowcharts)

يوضح هذا المستند من خلال المخططات الانسيابية (Flowcharts) كيف يتفاعل المستخدم مع "المكان" (المحلات/النقاط الجغرافية)، وما هي العلاقات المكانية التي تربط بينهما داخل النظام.

## 1. مخطط تدفق تفاعل المستخدم مع المكان (User-Location Interaction Flow)

هذا المخطط يوضح رحلة المستخدم منذ لحظة تحديد موقعه، مروراً باستعلام النظام عن الأماكن المحيطة، وصولاً إلى التفاعل مع المكان عبر الخريطة ثنائية الأبعاد (2D Map) أو واجهة الواقع المعزز (AR Viewer).

```mermaid
graph TD
    User("المستخدم (User)") -->|"1. يرسل إحداثياته الحالية (GPS)"| System{"نظام GIS المركزي"}
    
    System -->|"2. استعلام مكاني (Spatial Query)"| DB[("قاعدة البيانات المكانية (Spatial DB)")]
    DB -->|"3. إرجاع الأماكن ضمن النطاق (Radius)"| System
    
    System -->|"4. عرض على الخريطة"| MapUI["واجهة الخريطة التفاعلية (2D Map)"]
    MapUI -->|"5. ينقر ويختار"| Location("المكان / المحل (Shop)")
    
    User -->|"6. يطلب مسار (Routing)"| RoutingEngine["محرك التوجيه (Routing Engine)"]
    RoutingEngine -->|"7. رسم المسار الأقصر"| MapUI
    
    Location -->|"8. يمتلك بيانات مكانية ثلاثية الأبعاد"| ARData["محتوى الواقع المعزز (AR Content)"]
    
    User -->|"9. يفتح كاميرا الهاتف"| AR_UI["واجهة الواقع المعزز (AR Viewer)"]
    ARData -->|"10. إسقاط مكاني للمحتوى (3D Projection)"| AR_UI
    
    AR_UI -->|"11. تفاعل بصري وتجربة غامرة"| User

    style User fill:#d1e7dd,stroke:#0f5132,stroke-width:2px
    style Location fill:#f8d7da,stroke:#842029,stroke-width:2px
    style System fill:#cfe2ff,stroke:#084298,stroke-width:2px
```

---

## 2. مخطط العلاقات المكانية (Spatial Relationships Diagram)

العلاقات المكانية هي الروابط الهندسية والجغرافية بين موقع "المستخدم" وموقع "المكان/المحل". يوضح هذا المخطط أهم المفاهيم المكانية (Spatial Topologies) التي يعالجها النظام.

```mermaid
graph LR
    subgraph Spatial_Relationships ["العلاقات المكانية (Spatial Topologies)"]
    direction TB
    
    UserLoc("موقع المستخدم (User Location)")
    ShopLoc("موقع المحل (Shop Location)")
    Buffer("نطاق البحث الشعاعي (Buffer/Radius)")
    Route("مسار الحركة (Routing Path)")

    UserLoc -->|"المسافة (Distance Analysis)"| ShopLoc
    ShopLoc -->|"يقع ضمن (Contains/Within)"| Buffer
    UserLoc -->|"المركز الفعلي لـ (Center of)"| Buffer
    UserLoc -->|"نقطة البداية لـ (Start Node)"| Route
    ShopLoc -->|"نقطة النهاية لـ (End Node)"| Route
    end
    
    style Spatial_Relationships fill:#fdfd96,stroke:#333,stroke-width:2px
```

### شرح مفصل للعلاقات المكانية في النظام:
1. **المسافة (Distance Analysis):** هي العلاقة الأساسية. النظام يحسب المسافة الإقليدية (أو مسافة هافرسين على سطح الكرة الأرضية) بين إحداثيات المستخدم الحالية وإحداثيات المكان (المحل).
2. **الاحتواء والتداخل (Within / Contains):** المستخدم يشكل حول نفسه "نطاقاً أو دائرة وهمية" (Buffer) نصف قطرها مثلاً (5 كيلومتر). العلاقة المكانية هنا تتأكد مما إذا كان موقع المحل (النقطة الجغرافية) يقع "ضمن" هذا النطاق ليتم عرضه للمستخدم أم لا.
3. **التوجيه والاتصال (Routing / Connectivity):** العلاقة هنا ليست مجرد خط مستقيم، بل هي مسار مرتبط بشبكة الطرق الحقيقية. موقع المستخدم يمثل النقطة (A)، وموقع المحل يمثل النقطة (B)، والنظام يستخرج العلاقة الخطية (المسار) بينهما.

---

## 3. المخطط الكياني للعلاقة بين المستخدم والمكان (ER Diagram)

كيف تترجم هذه العلاقات في هيكل النظام البرمجي وقاعدة البيانات:

```mermaid
erDiagram
    USER ||--o{ SPATIAL_INTERACTION : "يتفاعل مكانياً مع"
    USER {
        string User_ID
        float Current_Lat "خط العرض الحالي"
        float Current_Lng "خط الطول الحالي"
    }
    SHOP_LOCATION ||--o{ SPATIAL_INTERACTION : "يستقبل التفاعل"
    SHOP_LOCATION {
        string Shop_ID
        float Lat "خط العرض الثابت"
        float Lng "خط الطول الثابت"
        string Category "تصنيف المحل"
    }
    SPATIAL_INTERACTION {
        string Interaction_Type "بحث، توجيه، رؤية AR"
        float Distance_Meters "المسافة المحسوبة بينهما"
    }
    SHOP_LOCATION ||--o{ AR_CONTENT : "يحتوي على"
    AR_CONTENT {
        string Content_ID
        string Model_URL "رابط المجسم ثلاثي الأبعاد"
        float Altitude "الارتفاع عن مستوى الأرض"
    }
```
