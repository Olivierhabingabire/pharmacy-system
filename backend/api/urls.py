from django.urls import path

from .views import (
    ActivatePharmacist,
    Analytics,
    MedicineDetail,
    MedicineList,
    Me,
    PharmacistDetail,
    PharmacistList,
    RegisterPharmacist,
    RegistrationCode,
    SaleCreate,
    ValidateRegistrationCode,
)

urlpatterns = [
    path("medicines/", MedicineList.as_view()),
    path("medicines/<int:pk>/", MedicineDetail.as_view()),
    path("sales/", SaleCreate.as_view()),
    path("analytics/", Analytics.as_view()),
    path("me/", Me.as_view()),
    path("registration/code/", RegistrationCode.as_view()),
    path("registration/validate/", ValidateRegistrationCode.as_view()),
    path("registration/register/", RegisterPharmacist.as_view()),
    path("registration/activate/", ActivatePharmacist.as_view()),
    path("staff/pharmacists/", PharmacistList.as_view()),
    path("staff/pharmacists/<uuid:pk>/", PharmacistDetail.as_view()),
]