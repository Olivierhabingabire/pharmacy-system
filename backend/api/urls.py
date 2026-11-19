from django.urls import path

from .views import MedicineDetail, MedicineList

urlpatterns = [
    path("medicines/", MedicineList.as_view()),
    path("medicines/<int:pk>/", MedicineDetail.as_view()),
]