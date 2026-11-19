from django.db import IntegrityError
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response

from .models import Medicine
from .serializers import MedicineSerializer


class MedicineList(ListCreateAPIView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer


class MedicineDetail(RetrieveUpdateDestroyAPIView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer

    def destroy(self, request, *args, **kwargs):
        medicine = self.get_object()
        try:
            medicine.delete()
        except IntegrityError:
            return Response(
                {"detail": "This medicine has sales and cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)