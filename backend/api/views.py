from rest_framework.generics import ListAPIView

from .models import Medicine
from .serializers import MedicineSerializer


class MedicineList(ListAPIView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer