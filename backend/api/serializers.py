from decimal import Decimal

from rest_framework import serializers

from .models import Medicine


class MedicineSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=200)
    price = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01")
    )
    stock = serializers.IntegerField(min_value=0)

    class Meta:
        model = Medicine
        fields = ["id", "name", "price", "stock", "expiry_date"]