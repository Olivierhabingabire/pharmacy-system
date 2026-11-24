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


class SaleItemSerializer(serializers.Serializer):
    medicine_id = serializers.IntegerField(min_value=1)
    qty = serializers.IntegerField(min_value=1)


class SaleRequestSerializer(serializers.Serializer):
    items = SaleItemSerializer(many=True, allow_empty=False)

    def validate_items(self, items):
        ids = [item["medicine_id"] for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(
                "Each medicine may appear only once in a sale."
            )
        return items


class RegistrationCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=128, trim_whitespace=False)


class SetRegistrationCodeSerializer(RegistrationCodeSerializer):
    code = serializers.CharField(
        min_length=12, max_length=128, trim_whitespace=False
    )


class ActivatePharmacistSerializer(RegistrationCodeSerializer):
    full_name = serializers.CharField(
        max_length=200, trim_whitespace=True, required=False, allow_blank=True
    )