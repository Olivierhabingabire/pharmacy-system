from django.urls import path

from .views import Analytics, MedicineDetail, MedicineList, Me, SaleCreate

urlpatterns = [
    path("medicines/", MedicineList.as_view()),
    path("medicines/<int:pk>/", MedicineDetail.as_view()),
    path("sales/", SaleCreate.as_view()),
    path("analytics/", Analytics.as_view()),
    path("me/", Me.as_view()),
]