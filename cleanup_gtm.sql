-- Delete pageviews with GTM URLs
DELETE FROM pageviews 
WHERE pageUrl LIKE '%gtm-msr.appspot.com%' 
   OR pageUrl LIKE '%googletagmanager.com%' 
   OR pageUrl LIKE '%google-analytics.com%';
