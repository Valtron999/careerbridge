-- Reference data only (categories and plans). No sample jobs, employers or users.
insert into opportunity_categories (slug, name, kind, sort_order) values
 ('full-time','Full-time job','job',1),('part-time','Part-time job','job',2),('graduate-trainee','Graduate trainee','job',3),
 ('internship','Internship','placement',4),('siwes','SIWES','placement',5),('industrial-training','Industrial Training (IT)','placement',6),
 ('swep','SWEP','placement',7),('industrial-attachment','Student industrial attachment','placement',8),
 ('research-placement','Research placement','placement',9),('apprenticeship','Apprenticeship','placement',10)
on conflict (slug) do nothing;
insert into subscription_plans (code, name, price_ngn_kobo, limits, features) values
 ('free','Free',0,'{"active_listings":3}','["Company profile","Standard applicant management"]'),
 ('professional','Professional',0,'{"active_listings":20}','["Higher listing limits","Applicant filtering","Recruitment analytics"]'),
 ('business','Business',0,'{"active_listings":100,"team_members":10}','["Team collaboration","Advanced reporting"]')
on conflict (code) do nothing;
-- NOTE: paid plan prices are placeholders (0) until the business sets them in the admin area.
