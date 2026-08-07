package com.example.Portfolio_Manager.Model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(
		name = "price_history",
		uniqueConstraints = @UniqueConstraint(
				name = "uq_price_instrument_date",
				columnNames = {"instrument_id", "price_date"}
		)
)
public class Price_History {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "price_history_id")
	private Long priceHistoryId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "instrument_id", nullable = false)
	private Instrument instrument;

	@Column(name = "price_date", nullable = false)
	private LocalDate priceDate;

	@Column(name = "close_price", nullable = false, precision = 18, scale = 4)
	private BigDecimal closePrice;

	@Column(name = "open_price", precision = 18, scale = 4)
	private BigDecimal openPrice;

	@Column(name = "high_price", precision = 18, scale = 4)
	private BigDecimal highPrice;

	@Column(name = "low_price", precision = 18, scale = 4)
	private BigDecimal lowPrice;

	@Column(name = "volume")
	private Long volume;

	public Long getPriceHistoryId() {
		return priceHistoryId;
	}

	public void setPriceHistoryId(Long priceHistoryId) {
		this.priceHistoryId = priceHistoryId;
	}

	public Instrument getInstrument() {
		return instrument;
	}

	public void setInstrument(Instrument instrument) {
		this.instrument = instrument;
	}

	public LocalDate getPriceDate() {
		return priceDate;
	}

	public void setPriceDate(LocalDate priceDate) {
		this.priceDate = priceDate;
	}

	public BigDecimal getClosePrice() {
		return closePrice;
	}

	public void setClosePrice(BigDecimal closePrice) {
		this.closePrice = closePrice;
	}

	public BigDecimal getOpenPrice() {
		return openPrice;
	}

	public void setOpenPrice(BigDecimal openPrice) {
		this.openPrice = openPrice;
	}

	public BigDecimal getHighPrice() {
		return highPrice;
	}

	public void setHighPrice(BigDecimal highPrice) {
		this.highPrice = highPrice;
	}

	public BigDecimal getLowPrice() {
		return lowPrice;
	}

	public void setLowPrice(BigDecimal lowPrice) {
		this.lowPrice = lowPrice;
	}

	public Long getVolume() {
		return volume;
	}

	public void setVolume(Long volume) {
		this.volume = volume;
	}
}
