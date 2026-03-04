# Daily Activity Register (GitHub Pages + Google Sheet + Google Login)

এই প্যাকেজে আপনি পাবেন একটি **রেডি-টু-আপলোড** স্ট্যাটিক ওয়েবসাইট (GitHub Pages) যা Google Sheet-কে ডাটাবেস হিসেবে ব্যবহার করে।

## কী আছে
- ✅ Google Sign-In (GIS) — লগইন করলে **CreatedBy** অটো-ফিল
- ✅ ব্যবহারকারীভিত্তিক ফিল্টার — "শুধু আমার"
- ✅ CRUD (Create/Read/Update/Delete)
- ✅ ৯:০০ AM–৫:০০ PM, প্রতি ৩০ মিনিটে টাইম ড্রপডাউন, বর্তমান সময়ের নিকটতম স্লট অটো-সিলেক্ট
- ✅ CSV/Excel এক্সপোর্ট
- ✅ প্রিন্ট-ফ্রেন্ডলি ভিউ (আপনার দেওয়া টেমপ্লেট স্টাইল)
- ✅ ড্যাশবোর্ড (দিন/সপ্তাহ/মাসভিত্তিক চার্ট)

## ফাইলসমূহ
- `index.html` – UI + Tabs (Entry, List, Dashboard, Print)
- `style.css` – UI/Print স্টাইল
- `app.js` – ক্লায়েন্ট লজিক (Auth, CRUD, Export, Charts, Print)
- `apps_script.gs` – Google Apps Script (শিটের REST API + Google Login যাচাই)

## Google Sheet
শিটের প্রথম সারিতে এই হেডারগুলো দিন:
```
ID | Date | Time | Activity | Output | FollowUp | Comment | Notes | Delivery | CreatedBy | CreatedAt | UpdatedAt
```
শিটের ট্যাবের নাম `Sheet1` হলে ভালো, না হলে `apps_script.gs` এ `SHEET_NAME` পরিবর্তন করুন।

## Google Apps Script ডিপ্লয়
1) Sheet খুলে **Extensions → Apps Script**। `apps_script.gs` কপি–পেস্ট করুন।
2) ফাইলে এই তিনটি কনফিগ সেট করুন:
```js
const TOKEN = 'নিজের_মজবুত_টোকেন';
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const SHEET_NAME = 'Sheet1';
```
3) **Deploy → New deployment → Web app**
   - **Execute as:** Me
   - **Who has access:** Anyone
   - **Deploy** করে **Web App URL** কপি নিন।

> নোট: সার্ভারে Google ID Token যাচাই করা হচ্ছে `https://oauth2.googleapis.com/tokeninfo`–এর মাধ্যমে।

## GitHub Pages কনফিগ
1) এই ফোল্ডারের সব ফাইল রেপোতে আপলোড করুন।
2) **Settings → Pages** থেকে deploy (root / main branch)।
3) সাইট ওপেন করে Header-এর **Configuration**–এ দিন:
   - **API URL**: আপনার Web App URL (শেষে `/exec`)
   - **API TOKEN**: যে টোকেন `apps_script.gs`–এ দিয়েছেন
   - **Google Client ID**: Google Cloud Console থেকে নেওয়া Client ID

## ব্যবহার
- **Sign in with Google** বাটনে লগইন করুন।
- **Entry** ট্যাবে ডাটা সেভ করুন (CreatedBy অটো-সেট)।
- **তালিকা** ট্যাবে ফিল্টার/এডিট/ডিলিট/এক্সপোর্ট।
- **ড্যাশবোর্ড** ট্যাবে সময়পরিসর নির্বাচন করে চার্ট দেখুন।
- **প্রিন্ট** ট্যাবে তারিখ বেছে **প্রিভিউ/Print** করুন।

## সিকিউরিটি টিপস
- TOKEN গোপন রাখুন।
- Apps Script-এ CORS/রেট-লিমিট/ডোমেইন চেক বাড়ানো যায়।
- প্রয়োজনে Apps Script-এ `mine` বাদ দিয়ে সার্ভার-সাইডে সর্বত্র CreatedBy=enforced রাখুন।

## কাস্টমাইজেশন
- Output/Delivery-কে Dropdown/Checkbox করতে চাইলে `index.html` ও `app.js` এ সামান্য পরিবর্তন দরকার।
- Dashboard মেট্রিক বাড়ানো/কমানো যাবে।

