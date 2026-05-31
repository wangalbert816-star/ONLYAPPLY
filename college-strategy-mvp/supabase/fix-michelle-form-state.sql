-- Fix placeholder saved_applications with empty {} form_state (crashes My Applications page).
-- Safe to re-run: only patches rows that still have bare {}.

update public.saved_applications sa
set
  form_state = '{
    "intakeTerm": "",
    "intakeOtherDetail": "",
    "applicantIdentity": "",
    "citizenship": "",
    "residenceRegion": "",
    "budget": "",
    "testing": "",
    "satScore": "",
    "actScore": "",
    "highSchoolSystem": "",
    "currentHighSchool": "",
    "gpa": "",
    "gpaTrend": "",
    "languageScores": "",
    "academicSpecialFlags": [],
    "academicSpecialNotes": "",
    "majorPrimary": "",
    "majorSecondary": "",
    "schoolSize": "",
    "campusCulturePref": "",
    "geoPrefs": [],
    "activities": "",
    "structuredActivities": [],
    "riskStyle": "",
    "dealbreakers": ""
  }'::jsonb,
  updated_at = now()
from auth.users u
where sa.user_id = u.id
  and lower(u.email) = lower('michellezlou@gmail.com')
  and sa.form_state = '{}'::jsonb;
