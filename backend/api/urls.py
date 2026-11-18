from django.urls import path

from .views import MedicineList

urlpatterns = [
    path("medicines/", MedicineList.as_view()),
]