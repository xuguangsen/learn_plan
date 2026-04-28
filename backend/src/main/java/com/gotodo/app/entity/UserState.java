package com.gotodo.app.entity;

import java.time.Instant;

/**
 * 用户学习状态实体，对应 user_state 表。
 */
public class UserState {
  private Long id;
  private Long userId;
  private String stateJson;
  private Instant createdAt;
  private Instant updatedAt;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public String getStateJson() {
    return stateJson;
  }

  public void setStateJson(String stateJson) {
    this.stateJson = stateJson;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }
}
