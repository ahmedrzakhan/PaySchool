// src/pages/Profile.js
import { useEffect, useState } from "react";
import axios from "axios";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Load Stripe with your publishable key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function PaymentForm({ token, onSuccess, user }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [isFetchingClientSecret, setIsFetchingClientSecret] = useState(true);

  useEffect(() => {
    const fetchSetupIntent = async () => {
      try {
        setIsFetchingClientSecret(true);
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/payment/stripe/setup-intent`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log("Setup Intent Response:", response.data);
        setClientSecret(response.data.data.clientSecret);
        console.log("Client Secret Set:", response.data.data.clientSecret);
      } catch (err) {
        let errorMessage = "Failed to initialize payment form";
        if (err.response) {
          errorMessage = err.response.data.message || err.response.statusText;
        } else if (err.request) {
          errorMessage = "Network error: Unable to reach the server";
        } else {
          errorMessage = err.message;
        }
        setError(errorMessage);
        console.error("Error fetching Setup Intent:", err);
      } finally {
        setIsFetchingClientSecret(false);
      }
    };

    fetchSetupIntent();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe has not loaded yet");
      setLoading(false);
      return;
    }

    if (!clientSecret) {
      setError("Client secret is missing. Please try again.");
      setLoading(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);

    try {
      console.log("Confirming Setup Intent with clientSecret:", clientSecret);
      const { error, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: user.displayName,
              email: user.email,
            },
          },
        }
      );

      if (error) {
        setError(error.message);
        setLoading(false);
        console.error("Stripe Error:", error);
      } else if (setupIntent.status === "succeeded") {
        console.log("Payment method added successfully:", setupIntent);

        // Set the payment method as the default for the customer
        try {
          const paymentMethodId = setupIntent.payment_method;
          console.log("Setting default payment method:", paymentMethodId);
          await axios.post(
            `${process.env.REACT_APP_API_URL}/payment/stripe/set-default-payment-method`,
            { paymentMethodId },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          console.log("Default payment method set successfully");
        } catch (err) {
          setError(
            "Payment method added, but failed to set as default: " + err.message
          );
          setLoading(false);
          console.error("Error setting default payment method:", err);
          return;
        }

        onSuccess();
        setLoading(false);
      } else if (setupIntent.status === "requires_action") {
        console.log("Setup Intent requires action (3D Secure):", setupIntent);
        const { error: confirmError } = await stripe.confirmCardSetup(
          clientSecret
        );
        if (confirmError) {
          setError(confirmError.message);
          setLoading(false);
          console.error("3D Secure Error:", confirmError);
        } else {
          console.log("3D Secure confirmation succeeded");

          onSuccess();
          setLoading(false);
        }
      }
    } catch (err) {
      setError("An unexpected error occurred: " + err.message);
      setLoading(false);
      console.error("Unexpected Error:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add Payment Method</h3>
      <CardElement
        options={{
          style: {
            base: {
              fontSize: "16px",
              color: "#424770",
              "::placeholder": {
                color: "#aab7c4",
              },
            },
            invalid: {
              color: "#9e2146",
            },
          },
        }}
      />
      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
      <button
        type="submit"
        disabled={!stripe || loading || isFetchingClientSecret}
      >
        {isFetchingClientSecret
          ? "Loading..."
          : loading
          ? "Processing..."
          : "Add Payment Method"}
      </button>
    </form>
  );
}

function Profile({ user, setUser, token, handleLogout }) {
  const [paymentAdded, setPaymentAdded] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/user/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setUser(response.data.data);
      } catch (err) {
        console.error("Error fetching profile:", err);
        handleLogout();
      }
    };

    if (!user) {
      fetchProfile();
    }
  }, [user, token, setUser, handleLogout]);

  const handleCreateInvoice = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/payment/stripe/create-invoice`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("Invoice Response:", response.data);
      setInvoiceSent(true);
      setInvoiceUrl(response.data.data.invoiceUrl);
    } catch (err) {
      let errorMessage = "Failed to create invoice";
      if (err.response) {
        errorMessage = err.response.data.message || err.response.statusText;
      } else if (err.request) {
        errorMessage = "Network error: Unable to reach the server";
      } else {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error("Error creating invoice:", err);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Profile</h1>
      <p>Name: {user.displayName}</p>
      <p>Email: {user.email}</p>
      {paymentAdded ? (
        <div>
          <p>Payment method added successfully!</p>
          {!invoiceSent ? (
            <button onClick={handleCreateInvoice}>
              Create and Send Invoice
            </button>
          ) : (
            <div>
              <p>Invoice sent successfully!</p>
              {invoiceUrl && (
                <p>
                  View your invoice{" "}
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    here
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <Elements stripe={stripePromise}>
          <PaymentForm
            token={token}
            onSuccess={() => setPaymentAdded(true)}
            user={user}
          />
        </Elements>
      )}
      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default Profile;
